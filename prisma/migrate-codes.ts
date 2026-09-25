// One-time migration: name/color slugs in URLs → unique product codes.
// Gives every colorway without a `code` a new one (e.g. "7K2Q"), then drops
// the old product `slug` and variant `slug` fields and their index.
// Run with `npm run db:migrate-codes`; safe to re-run.
import { PrismaClient } from "@prisma/client";
import { generateCodes } from "../src/lib/codes";

const db = new PrismaClient();

interface RawVariant {
  name: string;
  code?: string;
  slug?: string;
  [key: string]: unknown;
}
interface RawProduct {
  _id: { $oid: string };
  name: string;
  slug?: string;
  variants: RawVariant[];
}

async function main() {
  // Drop the unique index on the old product slug *first*: once slugs are
  // unset, every product would share the same "missing" key and all but
  // the first write would be rejected as duplicates.
  try {
    await db.$runCommandRaw({ dropIndexes: "Product", index: "Product_slug_key" });
    console.log("Dropped old index Product_slug_key");
  } catch {
    // already gone
  }

  const raw = (await db.product.findRaw()) as unknown as RawProduct[];
  const taken = new Set(raw.flatMap((p) => p.variants.map((v) => v.code).filter((c): c is string => !!c)));
  let assigned = 0;

  for (const p of raw) {
    const missing = p.variants.filter((v) => !v.code).length;
    const fresh = generateCodes(missing, taken);
    const variants = p.variants.map((v) => {
      const { slug: _dropped, ...rest } = v;
      return { ...rest, code: v.code ?? fresh.shift()! };
    });
    assigned += missing;

    const result = (await db.$runCommandRaw({
      update: "Product",
      updates: [
        {
          q: { _id: { $oid: p._id.$oid } },
          u: { $set: { variants }, $unset: { slug: "" } },
        },
      ],
    })) as { n?: number; writeErrors?: { errmsg: string }[] };
    // Raw commands report write failures in the result instead of throwing.
    if (result.writeErrors?.length || result.n !== 1) {
      throw new Error(`Update failed for ${p.name}: ${JSON.stringify(result.writeErrors ?? result)}`);
    }
    console.log(`${p.name}: ${variants.map((v) => `${v.name}=${v.code}`).join(", ")}`);
  }

  console.log(`Assigned ${assigned} code(s) across ${raw.length} product(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
