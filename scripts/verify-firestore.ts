import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type FirebaseConfig = {
    projectId?: string;
    firestoreDatabaseId?: string;
};

type CountyDoc = {
    name?: string;
    code?: string;
};

type WardDoc = {
    name?: string;
    countyId?: string;
};

const EXPECTED_COUNTIES = 47;
const EXPECTED_WARDS = 1448;

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

const main = async () => {
    const firebaseConfig = await readFirebaseConfig();
    const app = await initFirebase(firebaseConfig);
    const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID ?? firebaseConfig.firestoreDatabaseId ?? "(default)";
    const db = getFirestore(app, firestoreDatabaseId);

    console.log(`Using Firestore database: ${firestoreDatabaseId}`);

    const countiesSnapshot = await db.collection("counties").get();
    const wardsSnapshot = await db.collection("wards").get();

    const countyById = new Map<string, CountyDoc>();
    countiesSnapshot.docs.forEach((doc) => countyById.set(doc.id, doc.data() as CountyDoc));

    const wardCountsByCounty = new Map<string, number>();
    const unknownCountyIds = new Set<string>();

    wardsSnapshot.docs.forEach((doc) => {
        const ward = doc.data() as WardDoc;
        const countyId = ward.countyId ?? "";
        if (!countyId) return;

        if (!countyById.has(countyId)) {
            unknownCountyIds.add(countyId);
        }

        wardCountsByCounty.set(countyId, (wardCountsByCounty.get(countyId) ?? 0) + 1);
    });

    const missingCounties = countiesSnapshot.docs
        .filter((doc) => !wardCountsByCounty.has(doc.id))
        .map((doc) => {
            const data = doc.data() as CountyDoc;
            return data.name ?? doc.id;
        });

    const issues: string[] = [];

    if (countiesSnapshot.size !== EXPECTED_COUNTIES) {
        issues.push(`Expected ${EXPECTED_COUNTIES} counties, found ${countiesSnapshot.size}.`);
    }

    if (wardsSnapshot.size !== EXPECTED_WARDS) {
        issues.push(`Expected ${EXPECTED_WARDS} wards, found ${wardsSnapshot.size}.`);
    }

    if (missingCounties.length > 0) {
        issues.push(`Counties without wards: ${missingCounties.join(", ")}.`);
    }

    if (unknownCountyIds.size > 0) {
        issues.push(`Wards reference unknown county IDs: ${[...unknownCountyIds].join(", ")}.`);
    }

    console.log(`Counties: ${countiesSnapshot.size}`);
    console.log(`Wards: ${wardsSnapshot.size}`);

    if (issues.length > 0) {
        console.error("Firestore verification failed:");
        issues.forEach((issue) => console.error(`- ${issue}`));
        process.exit(1);
    }

    console.log("Firestore verification passed.");
};

main().catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
});
