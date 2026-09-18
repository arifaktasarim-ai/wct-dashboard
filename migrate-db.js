require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  console.log("");
  console.log("==============================================");
  console.log(" WCT DASHBOARD - DB.JSON -> SUPABASE");
  console.log("==============================================");

  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`db.json bulunamadi: ${DB_FILE}`);
  }

  console.log("");
  console.log("1) db.json okunuyor...");

  const raw = fs.readFileSync(DB_FILE, "utf8");

  let db;

  try {
    db = JSON.parse(raw);
  } catch (error) {
    throw new Error("db.json gecerli bir JSON degil.");
  }

  console.log("   db.json basariyla okundu.");

  console.log("");
  console.log("2) Mevcut veri kontrol ediliyor...");

  console.log(
    "   personel:",
    Array.isArray(db.personel) ? db.personel.length : 0
  );

  console.log(
    "   aksiyonlar:",
    Array.isArray(db.aksiyonlar) ? db.aksiyonlar.length : 0
  );

  console.log(
    "   toplantiNotlari:",
    Array.isArray(db.toplantiNotlari)
      ? db.toplantiNotlari.length
      : 0
  );

  console.log(
    "   sktTakip:",
    Array.isArray(db.sktTakip) ? db.sktTakip.length : 0
  );

  console.log(
    "   auditLog:",
    Array.isArray(db.auditLog) ? db.auditLog.length : 0
  );

  console.log(
    "   sessions:",
    Array.isArray(db.sessions) ? db.sessions.length : 0
  );

  console.log(
    "   asdSapmaKayitlari:",
    Array.isArray(db.asdSapmaKayitlari)
      ? db.asdSapmaKayitlari.length
      : 0
  );

  console.log("");
  console.log("3) Supabase baglantisi kontrol ediliyor...");

  await pool.query("SELECT NOW()");

  console.log("   Supabase baglantisi basarili.");

  console.log("");
  console.log("4) dashboard_data tablosu kontrol ediliyor...");

  const tableResult = await pool.query(`
    SELECT id
    FROM dashboard_data
    ORDER BY id
    LIMIT 1
  `);

  console.log("");
  console.log("5) db.json Supabase'e aktariliyor...");

  const jsonData = JSON.stringify(db);

  if (tableResult.rows.length === 0) {
    await pool.query(
      `
      INSERT INTO dashboard_data (data)
      VALUES ($1::jsonb)
      `,
      [jsonData]
    );

    console.log("   Yeni dashboard_data kaydi olusturuldu.");
  } else {
    const id = tableResult.rows[0].id;

    await pool.query(
      `
      UPDATE dashboard_data
      SET data = $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
      `,
      [jsonData, id]
    );

    console.log(
      `   Mevcut dashboard_data kaydi guncellendi. ID: ${id}`
    );
  }

  console.log("");
  console.log("6) Aktarim dogrulaniyor...");

  const verifyResult = await pool.query(`
    SELECT
      id,
      jsonb_typeof(data) AS data_type
    FROM dashboard_data
    ORDER BY id
  `);

  console.log("");

  for (const row of verifyResult.rows) {
    console.log(
      `   ID: ${row.id} | data tipi: ${row.data_type}`
    );
  }

  console.log("");
  console.log("==============================================");
  console.log(" AKTARIM BASARIYLA TAMAMLANDI");
  console.log("==============================================");
  console.log("");
  console.log("Mevcut db.json verilerin Supabase'e aktarildi.");
  console.log("db.json dosyan bilgisayarinda korunuyor.");
  console.log("");
}

migrate()
  .catch(error => {
    console.error("");
    console.error("==============================================");
    console.error(" AKTARIM HATASI");
    console.error("==============================================");
    console.error("");
    console.error(error.message);
    console.error("");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });