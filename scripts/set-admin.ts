import { createClient } from "@libsql/client";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:./private/slovakgo.sqlite";
const dbToken = process.env.TURSO_AUTH_TOKEN;

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Помилка: вкажіть email користувача.");
  console.error("Використання: npx tsx scripts/set-admin.ts user@example.com");
  process.exit(1);
}

const db = createClient({
  url: dbUrl,
  authToken: dbToken,
});

async function run() {
  console.log(`Підключення до бази даних: ${dbUrl}`);
  
  // Check if user exists
  const res = await db.execute({
    sql: "SELECT id, name_text, role FROM users WHERE email = ? LIMIT 1",
    args: [email]
  });

  if (res.rows.length === 0) {
    console.error(`Користувача з email "${email}" не знайдено в базі даних.`);
    process.exit(1);
  }

  const user = res.rows[0];
  console.log(`Знайдено користувача: ${user.name_text} (ID: ${user.id}), поточна роль: ${user.role}`);

  // Update role to admin
  await db.execute({
    sql: "UPDATE users SET role = 'admin', updated_at = ? WHERE email = ?",
    args: [new Date().toISOString(), email]
  });

  console.log(`✓ Успішно! Роль користувача "${email}" змінено на "admin".`);
}

run().catch(err => {
  console.error("Помилка виконання:", err);
  process.exit(1);
});
