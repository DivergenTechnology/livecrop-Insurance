// scripts/seed.ts
// Idempotent seed: clears existing data first, then creates demo data.
//
// Run with:  bun run scripts/seed.ts

import { PrismaClient } from '@prisma/client';
import { generateReadings } from '../src/lib/ndvi-simulator';

const db = new PrismaClient();

// Helper to build a rectangular GeoJSON Polygon Feature from [lon,lat] corners.
function rectPolygon(
  lonMin: number,
  latMin: number,
  lonMax: number,
  latMax: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lonMin, latMin],
          [lonMax, latMin],
          [lonMax, latMax],
          [lonMin, latMax],
          [lonMin, latMin], // closed ring
        ],
      ],
    },
  };
}

async function main() {
  console.log('Clearing existing data...');
  // Delete in dependency order.
  await db.settlement.deleteMany();
  await db.insuranceClaim.deleteMany();
  await db.telemetryReading.deleteMany();
  await db.policy.deleteMany();
  await db.cropStageVulnerability.deleteMany();
  await db.cropVariety.deleteMany();
  await db.livestockAsset.deleteMany();
  await db.farmPlot.deleteMany();
  await db.farmer.deleteMany();

  // 1. Crop varieties + stages.
  console.log('Seeding crop varieties...');
  const varietiesData = [
    {
      name: 'Maize',
      stages: [
        { stage: 'EMERGENCE', startDayOffset: 0, endDayOffset: 14, stageKyFactor: 0.2, replantWindowFlag: true },
        { stage: 'VEGETATIVE', startDayOffset: 15, endDayOffset: 60, stageKyFactor: 0.4, replantWindowFlag: false },
        { stage: 'FLOWERING', startDayOffset: 61, endDayOffset: 90, stageKyFactor: 1.3, replantWindowFlag: false },
        { stage: 'MATURITY', startDayOffset: 91, endDayOffset: 120, stageKyFactor: 0.8, replantWindowFlag: false },
      ],
    },
    {
      name: 'Wheat',
      stages: [
        { stage: 'EMERGENCE', startDayOffset: 0, endDayOffset: 14, stageKyFactor: 0.2, replantWindowFlag: true },
        { stage: 'VEGETATIVE', startDayOffset: 15, endDayOffset: 60, stageKyFactor: 0.45, replantWindowFlag: false },
        { stage: 'FLOWERING', startDayOffset: 61, endDayOffset: 90, stageKyFactor: 1.15, replantWindowFlag: false },
        { stage: 'MATURITY', startDayOffset: 91, endDayOffset: 120, stageKyFactor: 0.7, replantWindowFlag: false },
      ],
    },
    {
      name: 'Rice',
      stages: [
        { stage: 'EMERGENCE', startDayOffset: 0, endDayOffset: 14, stageKyFactor: 0.25, replantWindowFlag: true },
        { stage: 'VEGETATIVE', startDayOffset: 15, endDayOffset: 60, stageKyFactor: 0.5, replantWindowFlag: false },
        { stage: 'FLOWERING', startDayOffset: 61, endDayOffset: 90, stageKyFactor: 1.4, replantWindowFlag: false },
        { stage: 'MATURITY', startDayOffset: 91, endDayOffset: 120, stageKyFactor: 0.85, replantWindowFlag: false },
      ],
    },
    {
      name: 'Soybean',
      stages: [
        { stage: 'EMERGENCE', startDayOffset: 0, endDayOffset: 14, stageKyFactor: 0.2, replantWindowFlag: true },
        { stage: 'VEGETATIVE', startDayOffset: 15, endDayOffset: 60, stageKyFactor: 0.4, replantWindowFlag: false },
        { stage: 'FLOWERING', startDayOffset: 61, endDayOffset: 90, stageKyFactor: 1.1, replantWindowFlag: false },
        { stage: 'MATURITY', startDayOffset: 91, endDayOffset: 120, stageKyFactor: 0.75, replantWindowFlag: false },
      ],
    },
  ];

  const varietyIds: Record<string, string> = {};
  for (const v of varietiesData) {
    const created = await db.cropVariety.create({
      data: {
        name: v.name,
        stages: { create: v.stages },
      },
      include: { stages: true },
    });
    varietyIds[v.name] = created.id;
    console.log(`  ✓ ${v.name} (${created.stages.length} stages)`);
  }

  // 2. Farmers in different regions.
  console.log('Seeding farmers...');
  const farmers = await Promise.all([
    db.farmer.create({ data: { name: 'Wanjiru Kamau', phone: '+254712345678', region: 'Central Highlands' } }),
    db.farmer.create({ data: { name: 'David Cheruiyot', phone: '+254722334455', region: 'Rift Valley' } }),
    db.farmer.create({ data: { name: 'Amina Mwakio', phone: '+254733889900', region: 'Coastal Region' } }),
  ]);
  console.log(`  ✓ ${farmers.length} farmers`);

  // 3. Plots. 4 plots, with 2 of them deliberately overlapping.
  // Central Highlands: ~ -0.42, 36.95  (Nyeri area)
  // Rift Valley: ~ -0.28, 35.28       (Kericho area)
  // Coastal Region: ~ -3.20, 39.60    (Mombasa area)
  const now = new Date();
  console.log('Seeding plots (with 2 overlapping)...');
  const plotA = rectPolygon(36.90, -0.45, 36.95, -0.40); // Plot 1
  const plotB = rectPolygon(36.93, -0.43, 36.98, -0.38); // Plot 2 — overlaps Plot 1
  const plotC = rectPolygon(35.20, -0.30, 35.30, -0.20); // Plot 3 — Rift Valley, isolated
  const plotD = rectPolygon(39.55, -3.25, 39.65, -3.15); // Plot 4 — Coastal, isolated

  const plots = await Promise.all([
    db.farmPlot.create({
      data: {
        farmerId: farmers[0].id,
        plotName: 'Nyeri Highland Block A',
        cropType: 'Maize',
        plotDate: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000),
        areaHectares: 4.2,
        boundaryGeoJson: JSON.stringify(plotA),
        soilType: 'Volcanic loam',
        fertilizerUsed: 'DAP + CAN',
      },
    }),
    db.farmPlot.create({
      data: {
        farmerId: farmers[0].id,
        plotName: 'Nyeri Highland Block B (overlapping)',
        cropType: 'Maize',
        plotDate: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000),
        areaHectares: 3.5,
        boundaryGeoJson: JSON.stringify(plotB),
        soilType: 'Volcanic loam',
        fertilizerUsed: 'DAP + CAN',
      },
    }),
    db.farmPlot.create({
      data: {
        farmerId: farmers[1].id,
        plotName: 'Kericho Tea-Belt Field',
        cropType: 'Wheat',
        plotDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        areaHectares: 12.8,
        boundaryGeoJson: JSON.stringify(plotC),
        soilType: 'Red sandy loam',
        fertilizerUsed: 'NPK 17-17-17',
      },
    }),
    db.farmPlot.create({
      data: {
        farmerId: farmers[2].id,
        plotName: 'Mombasa Coastal Plot',
        cropType: 'Rice',
        plotDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        areaHectares: 6.0,
        boundaryGeoJson: JSON.stringify(plotD),
        soilType: 'Sandy clay',
        fertilizerUsed: 'Urea + Manure',
      },
    }),
  ]);

  // 4. Livestock. 1 dairy cow, 1 beef steer, 1 poultry flock.
  //    New fields: livestockType, ageYears, headCount, registrationDate, declaredValue (per head).
  console.log('Seeding livestock...');
  const livestock = await Promise.all([
    db.livestockAsset.create({
      data: {
        farmerId: farmers[0].id,
        livestockType: 'Cattle',
        category: 'DAIRY',
        uniqueTagId: 'COW-DAIRY-001',
        ageYears: 4.5,
        headCount: 1,
        registrationDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        declaredValue: 85000,
      },
    }),
    db.livestockAsset.create({
      data: {
        farmerId: farmers[1].id,
        livestockType: 'Cattle',
        category: 'BEEF',
        uniqueTagId: 'STEER-BEEF-042',
        ageYears: 2.0,
        headCount: 1,
        registrationDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        declaredValue: 52000,
      },
    }),
    db.livestockAsset.create({
      data: {
        farmerId: farmers[2].id,
        livestockType: 'Poultry',
        category: 'POULTRY',
        uniqueTagId: 'FLOCK-POULTRY-300',
        ageYears: 0.5,
        headCount: 300,
        registrationDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
        declaredValue: 600, // per head
      },
    }),
  ]);
  console.log(`  ✓ ${livestock.length} livestock assets`);

  // 5. Policies. 1 crop, 1 livestock.
  console.log('Seeding policies...');
  const coverageStart = new Date(now);
  coverageStart.setDate(coverageStart.getDate() - 75); // ~75 days into the season → FLOWERING
  const coverageEnd = new Date(now);
  coverageEnd.setMonth(coverageEnd.getMonth() + 6);

  const cropPolicy = await db.policy.create({
    data: {
      farmerId: farmers[0].id,
      assetType: 'CROP',
      plotId: plots[0].id,
      varietyId: varietyIds['Maize'],
      sumInsured: 120000,
      inputCost: 30000,
      premium: Number((120000 * 0.05).toFixed(2)),
      coverageStart,
      coverageEnd,
      status: 'ACTIVE',
    },
  });

  const livestockPolicy = await db.policy.create({
    data: {
      farmerId: farmers[0].id,
      assetType: 'LIVESTOCK',
      livestockId: livestock[0].id,
      sumInsured: 85000,
      inputCost: 0,
      premium: Number((85000 * 0.08).toFixed(2)),
      coverageStart: now,
      coverageEnd,
      status: 'ACTIVE',
    },
  });
  console.log(`  ✓ 2 policies (crop on Maize/Nyeri Block A, livestock on dairy cow)`);

  // 6. Telemetry for all plots.
  console.log('Seeding telemetry for all plots...');
  let totalReadings = 0;
  for (const plot of plots) {
    const readings = generateReadings(plot.id, 60);
    await db.telemetryReading.createMany({
      data: readings.map((r) => ({
        plotId: plot.id,
        timestamp: r.timestamp,
        ndvi: r.ndvi,
        rainfall: r.rainfall,
        source: 'SENTINEL_2',
      })),
    });
    totalReadings += readings.length;
  }
  console.log(`  ✓ ${totalReadings} telemetry readings across ${plots.length} plots`);

  console.log('\n✅ Seed complete.');
  console.log(`   Farmers:   ${farmers.length}`);
  console.log(`   Plots:     ${plots.length}`);
  console.log(`   Livestock: ${livestock.length}`);
  console.log(`   Policies:  2 (${cropPolicy.id.slice(-6)}, ${livestockPolicy.id.slice(-6)})`);
  console.log(`   Telemetry: ${totalReadings} rows`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
