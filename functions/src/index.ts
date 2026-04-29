/**
 * Cabine Grid — Cloud Functions (Phase 3)
 *
 * Functions:
 * 1. onSaleWrite — Auto-update customer metrics + loyalty on every sale
 * 2. scheduledArchive — Archive old sales, auditLogs, stockMovements (weekly)
 * 3. scheduledRFMSegmentation — Calculate customer RFM segments (daily)
 * 4. onUserCreate — Set custom claims for role-based security rules
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ============================================================================
// 1. ON SALE WRITE — Auto-update customer metrics + loyalty
// ============================================================================

export const onSaleWrite = functions.firestore
  .document("sales/{saleId}")
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return; // Deleted sale, skip

    const customerId: string | undefined = after.customerId;
    if (!customerId) return; // Occasional client, no CRM update needed

    try {
      const customerRef = db.collection("customers").doc(customerId);
      const customerSnap = await customerRef.get();
      if (!customerSnap.exists) return;

      // Re-aggregate all sales for this customer
      const salesSnap = await db
        .collection("sales")
        .where("customerId", "==", customerId)
        .get();

      let totalSessions = 0;
      let totalSpent = 0;
      let totalMinutesRented = 0;
      let totalProductsBought = 0;
      const machineUsage: Record<string, number> = {};
      const visitsByWeekday: Record<string, number> = {};
      const visitHours: Record<string, number> = {};
      let lastVisitAt: admin.firestore.Timestamp | null = null;

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        totalSessions++;
        totalSpent += sale.amount || 0;
        totalMinutesRented += sale.totalMinutes || 0;

        // Count products
        if (Array.isArray(sale.soldProducts)) {
          sale.soldProducts.forEach((p: any) => {
            totalProductsBought += p.quantity || 1;
          });
        }

        // Machine usage
        const machineName = sale.machineName || sale.stationName;
        if (machineName) {
          machineUsage[machineName] = (machineUsage[machineName] || 0) + 1;
        }

        // Visit patterns
        const endTime = sale.endTime;
        if (endTime && typeof endTime.toDate === "function") {
          const date = endTime.toDate();
          const weekday = String(date.getDay());
          const hour = String(date.getHours());
          visitsByWeekday[weekday] = (visitsByWeekday[weekday] || 0) + 1;
          visitHours[hour] = (visitHours[hour] || 0) + 1;

          if (!lastVisitAt || endTime.toMillis() > lastVisitAt.toMillis()) {
            lastVisitAt = endTime;
          }
        }
      });

      // Calculate loyalty level
      let loyaltyLevel: "bronze" | "silver" | "gold" = "bronze";
      if (totalSpent >= 300) {
        loyaltyLevel = "gold";
      } else if (totalSpent >= 100) {
        loyaltyLevel = "silver";
      }

      // Update customer in a single write
      await customerRef.update({
        totalSpent,
        loyaltyLevel,
        "metrics.totalSessions": totalSessions,
        "metrics.totalSpent": totalSpent,
        "metrics.totalMinutesRented": totalMinutesRented,
        "metrics.totalProductsBought": totalProductsBought,
        "metrics.machineUsage": machineUsage,
        "metrics.visitsByWeekday": visitsByWeekday,
        "metrics.visitHours": visitHours,
        ...(lastVisitAt ? { "metrics.lastVisitAt": lastVisitAt } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(
        `Updated customer ${customerId}: loyalty=${loyaltyLevel}, spent=${totalSpent}`,
        { customerId, loyaltyLevel, totalSpent }
      );
    } catch (error) {
      functions.logger.error("Failed to update customer metrics", {
        customerId,
        error,
      });
    }
  });

// ============================================================================
// 2. SCHEDULED ARCHIVE — Move old documents to archive collections
// ============================================================================

export const scheduledArchive = functions.pubsub
  .schedule("every sunday 03:00")
  .timeZone("America/Lima")
  .onRun(async () => {
    const cutoffDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    const archiveConfig = [
      {
        source: "sales",
        archive: "sales_archive",
        dateField: "endTime",
        cutoff: cutoffTimestamp,
      },
      {
        source: "auditLogs",
        archive: "auditLogs_archive",
        dateField: "createdAtMs",
        cutoff: cutoffDate.getTime(), // auditLogs uses ms number
        isMillis: true,
      },
      {
        source: "stockMovements",
        archive: "stockMovements_archive",
        dateField: "createdAt",
        cutoff: cutoffTimestamp,
      },
      {
        source: "inventory_movements",
        archive: "inventory_movements_archive",
        dateField: "createdAt",
        cutoff: cutoffTimestamp,
      },
    ];

    for (const config of archiveConfig) {
      try {
        let queryRef;
        if (config.isMillis) {
          queryRef = db
            .collection(config.source)
            .where(config.dateField, "<", config.cutoff)
            .limit(500);
        } else {
          queryRef = db
            .collection(config.source)
            .where(config.dateField, "<", config.cutoff)
            .limit(500);
        }

        const snapshot = await queryRef.get();
        if (snapshot.empty) {
          functions.logger.info(`No documents to archive in ${config.source}`);
          continue;
        }

        // Batch archive + delete
        const batchSize = 500;
        let batch = db.batch();
        let count = 0;

        for (const doc of snapshot.docs) {
          const archiveRef = db.collection(config.archive).doc(doc.id);
          batch.set(archiveRef, {
            ...doc.data(),
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            originalCollection: config.source,
          });
          batch.delete(doc.ref);
          count++;

          if (count % batchSize === 0) {
            await batch.commit();
            batch = db.batch();
          }
        }

        if (count % batchSize !== 0) {
          await batch.commit();
        }

        functions.logger.info(
          `Archived ${count} documents from ${config.source} to ${config.archive}`
        );
      } catch (error) {
        functions.logger.error(`Failed to archive ${config.source}`, { error });
      }
    }
  });

// ============================================================================
// 3. SCHEDULED RFM SEGMENTATION — Daily customer segmentation
// ============================================================================

export const scheduledRFMSegmentation = functions.pubsub
  .schedule("every day 04:00")
  .timeZone("America/Lima")
  .onRun(async () => {
    try {
      const customersSnap = await db.collection("customers").get();
      if (customersSnap.empty) return;

      const now = Date.now();
      const batch = db.batch();
      let updateCount = 0;

      for (const doc of customersSnap.docs) {
        const customer = doc.data();
        const metrics = customer.metrics || {};

        // Recency: days since last visit
        let recencyDays = 999;
        if (metrics.lastVisitAt) {
          const lastVisitMs =
            typeof metrics.lastVisitAt.toMillis === "function"
              ? metrics.lastVisitAt.toMillis()
              : 0;
          if (lastVisitMs > 0) {
            recencyDays = Math.floor((now - lastVisitMs) / (1000 * 60 * 60 * 24));
          }
        }

        // Frequency: total sessions
        const frequency = metrics.totalSessions || 0;

        // Monetary: total spent
        const monetary = metrics.totalSpent || 0;

        // RFM Scores (1-5 scale)
        const recencyScore =
          recencyDays <= 7 ? 5 :
          recencyDays <= 14 ? 4 :
          recencyDays <= 30 ? 3 :
          recencyDays <= 60 ? 2 : 1;

        const frequencyScore =
          frequency >= 20 ? 5 :
          frequency >= 10 ? 4 :
          frequency >= 5 ? 3 :
          frequency >= 2 ? 2 : 1;

        const monetaryScore =
          monetary >= 500 ? 5 :
          monetary >= 200 ? 4 :
          monetary >= 100 ? 3 :
          monetary >= 30 ? 2 : 1;

        // Segment classification
        let segment: "champion" | "loyal" | "potential" | "new" | "at-risk" | "hibernating" | "lost";
        const rfmAvg = (recencyScore + frequencyScore + monetaryScore) / 3;

        if (recencyScore >= 4 && frequencyScore >= 4 && monetaryScore >= 4) {
          segment = "champion";
        } else if (recencyScore >= 3 && frequencyScore >= 3) {
          segment = "loyal";
        } else if (recencyScore >= 4 && frequencyScore <= 2) {
          segment = frequency === 0 ? "new" : "potential";
        } else if (recencyScore <= 2 && frequencyScore >= 3) {
          segment = "at-risk";
        } else if (recencyScore <= 2 && frequencyScore <= 2 && monetary > 0) {
          segment = "hibernating";
        } else if (recencyDays > 90 && frequency > 0) {
          segment = "lost";
        } else {
          segment = "new";
        }

        batch.update(doc.ref, {
          segment,
          lastVisitDaysAgo: recencyDays,
          "rfmScore.recency": recencyScore,
          "rfmScore.frequency": frequencyScore,
          "rfmScore.monetary": monetaryScore,
          "rfmScore.average": Math.round(rfmAvg * 10) / 10,
          "rfmScore.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
        });
        updateCount++;

        // Commit in batches of 500
        if (updateCount % 500 === 0) {
          await batch.commit();
        }
      }

      if (updateCount % 500 !== 0) {
        await batch.commit();
      }

      functions.logger.info(`RFM segmentation completed: ${updateCount} customers updated`);
    } catch (error) {
      functions.logger.error("RFM segmentation failed", { error });
    }
  });

// ============================================================================
// 4. ON USER CREATE — Set custom claims for optimized security rules
// ============================================================================

export const onUserProfileWrite = functions.firestore
  .document("users/{userId}")
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const after = change.after.exists ? change.after.data() : null;

    if (!after) return; // User deleted

    const role = after.role || "view-only";
    const locationIds = after.locationIds || [];

    try {
      // Set custom claims on the Firebase Auth user
      await admin.auth().setCustomUserClaims(userId, {
        role,
        locationIds,
      });

      functions.logger.info(`Custom claims set for user ${userId}`, {
        userId,
        role,
        locationIds,
      });
    } catch (error) {
      // User might not exist in Auth yet (profile created before first login)
      functions.logger.warn(`Could not set custom claims for ${userId}`, {
        error,
      });
    }
  });
