import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const MAX_BATCH_WRITES = 500;
const VALID_MEAL_TYPES = new Set(["breakfast", "lunch", "dinner"]);

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function toPaiseOrNull(value) {
  const rupees = Number(value);
  if (!Number.isFinite(rupees)) {
    return null;
  }
  return Math.round(rupees * 100);
}

function toPaise(value) {
  const paise = toPaiseOrNull(value);
  return paise ?? 0;
}

function normalizeMealType(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!VALID_MEAL_TYPES.has(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeDateKey(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
      return trimmed.replace(/\//g, "-");
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split("-");
      return `${yyyy}-${mm}-${dd}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const day = String(parsed.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const day = String(parsed.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

function normalizeItems(rawItems, orderId) {
  const sourceItems = Array.isArray(rawItems)
    ? rawItems
    : rawItems && typeof rawItems === "object"
      ? Object.values(rawItems)
      : [];

  const items = [];

  for (const rawItem of sourceItems) {
    const item = toObject(rawItem);
    if (!item) {
      console.warn(`[SKIP] order ${orderId}: invalid item payload.`);
      continue;
    }

    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) {
      console.warn(`[SKIP] order ${orderId}: item with missing name.`);
      continue;
    }

    const quantityValue = Number(item.quantity);
    const quantity = Number.isFinite(quantityValue) ? Math.trunc(quantityValue) : NaN;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      console.warn(`[SKIP] order ${orderId}: item '${name}' has invalid quantity.`);
      continue;
    }

    const unitPriceInPaise = toPaise(item.price);
    const lineTotalInPaise = unitPriceInPaise * quantity;

    const normalizedItem = {
      inventoryItemId: null,
      name,
      unitPriceInPaise,
      quantity,
      lineTotalInPaise
    };

    if (typeof item.alternateName === "string" && item.alternateName.trim()) {
      normalizedItem.alternateName = item.alternateName.trim();
    }

    items.push(normalizedItem);
  }

  return items;
}

function deriveCustomerName(customerId, orderEntries) {
  for (const [, rawOrder] of orderEntries) {
    const order = toObject(rawOrder);
    if (!order) {
      continue;
    }

    if (typeof order.customerName === "string" && order.customerName.trim()) {
      return order.customerName.trim();
    }
  }

  return customerId;
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const serviceAccountPath = path.resolve(__dirname, "serviceAccountKey.json");
  const exportPath = path.resolve(__dirname, "rtdb-export.json");

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error("serviceAccountKey.json not found in project root.");
  }

  if (!fs.existsSync(exportPath)) {
    throw new Error("rtdb-export.json not found in project root.");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse service account file: ${formatError(error)}`);
  }

  let exportData;
  try {
    exportData = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse rtdb-export.json: ${formatError(error)}`);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }

  const db = getFirestore();
  const history = toObject(exportData.customerOrderHistory);

  if (!history) {
    throw new Error("rtdb-export.json is missing customerOrderHistory.");
  }

  let batch = db.batch();
  let writesInBatch = 0;
  let batchIndex = 0;

  const totals = {
    customersProcessed: 0,
    ordersMigrated: 0,
    skipped: 0,
    errors: 0
  };

  const seenOrderIds = new Set();
  const existingOrderCache = new Map();

  async function commitBatchIfNeeded(force = false) {
    if (writesInBatch === 0) {
      return;
    }

    if (!force && writesInBatch < MAX_BATCH_WRITES) {
      return;
    }

    const writeCount = writesInBatch;
    try {
      await batch.commit();
      batchIndex += 1;
      console.log(`[BATCH] committed ${writeCount} writes (batch ${batchIndex}).`);
    } catch (error) {
      throw new Error(`Batch commit failed: ${formatError(error)}`);
    } finally {
      batch = db.batch();
      writesInBatch = 0;
    }
  }

  async function queueSet(docRef, data, options = undefined) {
    if (options) {
      batch.set(docRef, data, options);
    } else {
      batch.set(docRef, data);
    }

    writesInBatch += 1;
    await commitBatchIfNeeded(false);
  }

  async function orderAlreadyExists(orderId) {
    if (existingOrderCache.has(orderId)) {
      return existingOrderCache.get(orderId);
    }

    const doc = await db.collection("orders").doc(orderId).get();
    existingOrderCache.set(orderId, doc.exists);
    return doc.exists;
  }

  for (const [customerId, customerNode] of Object.entries(history)) {
    totals.customersProcessed += 1;

    try {
      const customerObj = toObject(customerNode);
      const ordersNode = customerObj ? toObject(customerObj.orders) : null;
      const orderEntries = ordersNode ? Object.entries(ordersNode) : [];
      const customerName = deriveCustomerName(customerId, orderEntries);

      await queueSet(
        db.collection("customers").doc(customerId),
        {
          id: customerId,
          name: customerName,
          phone: "",
          address: "",
          isActive: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      if (!ordersNode) {
        console.warn(`[WARN] customer ${customerId}: orders node missing.`);
        continue;
      }

      for (const [orderId, rawOrder] of orderEntries) {
        if (seenOrderIds.has(orderId)) {
          totals.skipped += 1;
          console.warn(`[SKIP] order ${orderId}: duplicate order ID in export.`);
          continue;
        }
        seenOrderIds.add(orderId);

        try {
          if (await orderAlreadyExists(orderId)) {
            totals.skipped += 1;
            console.log(`[SKIP] order ${orderId}: already migrated.`);
            continue;
          }

          const order = toObject(rawOrder);
          if (!order) {
            totals.skipped += 1;
            console.warn(`[SKIP] order ${orderId}: invalid order payload.`);
            continue;
          }

          const dateKey = normalizeDateKey(order.date);
          if (!dateKey) {
            totals.skipped += 1;
            console.warn(`[SKIP] order ${orderId}: missing/invalid date.`);
            continue;
          }

          const mealType = normalizeMealType(order.mealType);
          if (!mealType) {
            totals.skipped += 1;
            console.warn(`[SKIP] order ${orderId}: unsupported mealType '${String(order.mealType)}'.`);
            continue;
          }

          const items = normalizeItems(order.items, orderId);
          if (!items.length) {
            totals.skipped += 1;
            console.warn(`[SKIP] order ${orderId}: no valid items.`);
            continue;
          }

          const subtotalInPaise = items.reduce((sum, item) => sum + item.lineTotalInPaise, 0);
          const deliveryChargeInPaise = toPaise(order.deliveryCharges);
          const grandTotalInPaise = subtotalInPaise + deliveryChargeInPaise;
          const legacyGrandTotalInPaise = toPaiseOrNull(order.grandTotal);

          if (
            legacyGrandTotalInPaise !== null &&
            legacyGrandTotalInPaise !== grandTotalInPaise
          ) {
            console.warn(
              `[WARN] order ${orderId}: grandTotal mismatch (legacy=${legacyGrandTotalInPaise}, computed=${grandTotalInPaise}). Using computed value.`
            );
          }

          const customerNameFromOrder =
            typeof order.customerName === "string" && order.customerName.trim()
              ? order.customerName.trim()
              : customerName;

          await queueSet(db.collection("orders").doc(orderId), {
            id: orderId,
            dateKey,
            customerId,
            customerName: customerNameFromOrder,
            mealType,
            items,
            subtotalInPaise,
            deliveryMode: "none",
            deliveryChargeInPaise,
            grandTotalInPaise,
            status: "delivered",
            deliveredAt: FieldValue.serverTimestamp(),
            createdBy: "migration-script",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });

          totals.ordersMigrated += 1;
        } catch (error) {
          totals.errors += 1;
          console.error(`[ERROR] order ${orderId}: ${formatError(error)}`);
        }
      }
    } catch (error) {
      totals.errors += 1;
      console.error(`[ERROR] customer ${customerId}: ${formatError(error)}`);
    }
  }

  await commitBatchIfNeeded(true);

  console.log("\nMigration complete.");
  console.log(`Total customers processed: ${totals.customersProcessed}`);
  console.log(`Total orders migrated: ${totals.ordersMigrated}`);
  console.log(`Total skipped: ${totals.skipped}`);
  console.log(`Total errors: ${totals.errors}`);
}

main().catch((error) => {
  console.error(`Migration failed: ${formatError(error)}`);
  process.exit(1);
});
