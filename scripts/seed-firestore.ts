import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type County = {
    code: string;
    name: string;
    capital?: string;
    region?: string;
    population_2019?: number;
    area_km2?: number;
    postal_code?: string;
};

type Constituency = {
    code: string;
    name: string;
    county: string;
};

type Ward = {
    code: string;
    name: string;
    constituency: string;
};

type FirebaseConfig = {
    projectId?: string;
    firestoreDatabaseId?: string;
};

const DEFAULT_BUDGET_URL = "https://www.treasury.go.ke/budget-documents/";
const BATCH_LIMIT = 400;

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const readJson = async <T>(fileName: string): Promise<T> => {
    const dataDir = path.resolve(process.cwd(), "data");
    const raw = await fs.readFile(path.join(dataDir, fileName), "utf8");
    return JSON.parse(raw) as T;
};

const readFirebaseConfig = async (): Promise<FirebaseConfig> => {
    try {
        const raw = await fs.readFile(path.resolve(process.cwd(), "firebase-applet-config.json"), "utf8");
        return JSON.parse(raw) as FirebaseConfig;
    } catch {
        return {};
    }
};

const initFirebase = async (config: FirebaseConfig) => {
    if (getApps().length > 0) return getApps()[0];

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
        const raw = await fs.readFile(serviceAccountPath, "utf8");
        return initializeApp({ credential: cert(JSON.parse(raw)), projectId: config.projectId });
    }

    return initializeApp({ credential: applicationDefault(), projectId: config.projectId });
};

const purgeCollection = async (db: FirebaseFirestore.Firestore, collectionName: string) => {
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) return;

    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
        if (count >= BATCH_LIMIT) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }

        batch.delete(doc.ref);
        count += 1;
    }

    if (count > 0) {
        await batch.commit();
    }
};

const commitInBatches = async <T>(
    db: FirebaseFirestore.Firestore,
    items: T[],
    writer: (batch: FirebaseFirestore.WriteBatch, item: T) => void
) => {
    let batch = db.batch();
    let count = 0;

    for (const item of items) {
        if (count >= BATCH_LIMIT) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }

        writer(batch, item);
        count += 1;
    }

    if (count > 0) {
        await batch.commit();
    }
};

const main = async () => {
    const firebaseConfig = await readFirebaseConfig();
    const counties = await readJson<County[]>("kenya-counties.json");
    const constituencies = await readJson<Constituency[]>("kenya-constituencies.json");
    const wards = await readJson<Ward[]>("kenya-wards.json");

    const countyByName = new Map<string, County>();
    counties.forEach((county) => countyByName.set(normalize(county.name), county));

    const constituencyToCounty = new Map<string, string>();
    constituencies.forEach((constituency) => {
        constituencyToCounty.set(normalize(constituency.name), constituency.county);
    });

    const wardRecords: Array<{ ward: Ward; county: County }> = [];
    const unmappedWards: Ward[] = [];

    for (const ward of wards) {
        const countyName = constituencyToCounty.get(normalize(ward.constituency));
        if (!countyName) {
            unmappedWards.push(ward);
            continue;
        }

        const county = countyByName.get(normalize(countyName));
        if (!county) {
            unmappedWards.push(ward);
            continue;
        }

        wardRecords.push({ ward, county });
    }

    if (unmappedWards.length > 0) {
        const sample = unmappedWards.slice(0, 10).map((ward) => ward.name).join(", ");
        throw new Error(`Unmapped wards detected (${unmappedWards.length}). Sample: ${sample}.`);
    }

    const app = await initFirebase(firebaseConfig);
    const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID ?? firebaseConfig.firestoreDatabaseId ?? "(default)";
    const db = getFirestore(app, firestoreDatabaseId);
    const updatedAt = new Date().toISOString();
    const seedMode = (process.env.SEED_MODE ?? "upsert").toLowerCase();
    const existingCountyIdByName = new Map<string, string>();

    console.log(`Using Firestore database: ${firestoreDatabaseId}`);

    if (seedMode !== "replace") {
        const snapshot = await db.collection("counties").get();
        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (typeof data.name === "string") {
                const key = normalize(data.name);
                if (!existingCountyIdByName.has(key)) {
                    existingCountyIdByName.set(key, doc.id);
                }
            }
        });
    }

    if (seedMode === "replace") {
        if (process.env.SEED_CONFIRM !== "YES") {
            throw new Error("SEED_MODE=replace requires SEED_CONFIRM=YES to delete existing data.");
        }
        await purgeCollection(db, "wards");
        await purgeCollection(db, "counties");
    }

    const countyIdByName = new Map<string, string>();
    counties.forEach((county) => {
        const key = normalize(county.name);
        const resolvedId = existingCountyIdByName.get(key) ?? county.code;
        countyIdByName.set(key, resolvedId);
    });

    await commitInBatches(db, counties, (batch, county) => {
        const resolvedId = countyIdByName.get(normalize(county.name)) ?? county.code;
        const ref = db.collection("counties").doc(resolvedId);
        batch.set(
            ref,
            {
                name: county.name,
                code: county.code,
                capital: county.capital ?? null,
                region: county.region ?? null,
                population_2019: county.population_2019 ?? null,
                area_km2: county.area_km2 ?? null,
                postal_code: county.postal_code ?? null,
                budgetUrl: DEFAULT_BUDGET_URL,
                summary: "",
                updatedAt,
            },
            { merge: true }
        );
    });

    await commitInBatches(db, wardRecords, (batch, record) => {
        const ref = db.collection("wards").doc(record.ward.code);
        batch.set(
            ref,
            {
                name: record.ward.name,
                code: record.ward.code,
                constituency: record.ward.constituency,
                countyId: countyIdByName.get(normalize(record.county.name)) ?? record.county.code,
                countyName: record.county.name,
                totalBudget: 0,
                developmentBudget: 0,
                recurrentBudget: 0,
                projects: [],
                updatedAt,
            },
            { merge: true }
        );
    });

    console.log("Firestore seeding complete.");
    console.log(`Counties upserted: ${counties.length}`);
    console.log(`Wards upserted: ${wardRecords.length}`);
};

main().catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
});
