import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

type County = {
    code: string;
    name: string;
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

const EXPECTED_COUNTIES = 47;
const EXPECTED_WARDS = 1448;

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const readJson = async <T>(fileName: string): Promise<T> => {
    const dataDir = path.resolve(process.cwd(), "data");
    const raw = await fs.readFile(path.join(dataDir, fileName), "utf8");
    return JSON.parse(raw) as T;
};

const main = async () => {
    const counties = await readJson<County[]>("kenya-counties.json");
    const constituencies = await readJson<Constituency[]>("kenya-constituencies.json");
    const wards = await readJson<Ward[]>("kenya-wards.json");

    const countyByName = new Map<string, County>();
    counties.forEach((county) => countyByName.set(normalize(county.name), county));

    const constituencyToCounty = new Map<string, string>();
    constituencies.forEach((constituency) => {
        constituencyToCounty.set(normalize(constituency.name), constituency.county);
    });

    const wardsByCounty = new Map<string, Ward[]>();
    const unmappedWards: Ward[] = [];

    for (const ward of wards) {
        const countyName = constituencyToCounty.get(normalize(ward.constituency));
        if (!countyName) {
            unmappedWards.push(ward);
            continue;
        }

        const key = normalize(countyName);
        const list = wardsByCounty.get(key);
        if (list) {
            list.push(ward);
        } else {
            wardsByCounty.set(key, [ward]);
        }
    }

    const errors: string[] = [];

    if (counties.length !== EXPECTED_COUNTIES) {
        errors.push(`Expected ${EXPECTED_COUNTIES} counties, got ${counties.length}.`);
    }

    if (wards.length !== EXPECTED_WARDS) {
        errors.push(`Expected ${EXPECTED_WARDS} wards, got ${wards.length}.`);
    }

    const missingCountyNames = counties
        .filter((county) => (wardsByCounty.get(normalize(county.name))?.length ?? 0) === 0)
        .map((county) => county.name);

    if (missingCountyNames.length > 0) {
        errors.push(`Counties without wards: ${missingCountyNames.join(", ")}.`);
    }

    if (unmappedWards.length > 0) {
        const sample = unmappedWards.slice(0, 10).map((ward) => ward.name).join(", ");
        errors.push(`Unmapped wards: ${unmappedWards.length}. Sample: ${sample}.`);
    }

    const orphanCountyNames = new Set<string>();
    for (const countyName of constituencyToCounty.values()) {
        if (!countyByName.has(normalize(countyName))) {
            orphanCountyNames.add(countyName);
        }
    }

    if (orphanCountyNames.size > 0) {
        errors.push(`Constituencies reference unknown counties: ${[...orphanCountyNames].join(", ")}.`);
    }

    if (errors.length > 0) {
        console.error("Kenya data validation failed:");
        errors.forEach((error) => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log("Kenya data validation passed.");
    console.log(`Counties: ${counties.length}`);
    console.log(`Constituencies: ${constituencies.length}`);
    console.log(`Wards: ${wards.length}`);
};

main().catch((error) => {
    console.error("Validation script failed:", error);
    process.exit(1);
});
