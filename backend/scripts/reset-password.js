import { stdin } from "node:process";
import { postgres } from "../src/database.js";
import { hashPassword } from "../src/security.js";
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Uso: npm run reset-password -- email@dominio.com");
  process.exit(1);
}
// A password is read from stdin, never from argv or environment. Use a pipe on a trusted terminal.
let password = "";
if (stdin.isTTY) {
  console.error(
    "Envie a nova senha por stdin usando leitura oculta do terminal. Consulte README.md.",
  );
  process.exit(1);
}
for await (const chunk of stdin) {
  password += chunk.toString();
  if (password.length > 1024) throw new Error("Entrada muito longa.");
}
password = password.replace(/\r?\n$/, "");
if (password.length < 12 || password.length > 128)
  throw new Error("A senha precisa ter de 12 a 128 caracteres.");
const db = postgres();
try {
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const result = await tx.query(
      "UPDATE users SET password_hash=$1,updated_at=now() WHERE email=$2 RETURNING id",
      [hash, email],
    );
    if (!result.rows.length) throw new Error("Conta não encontrada.");
    await tx.query("DELETE FROM sessions WHERE user_id=$1", [
      result.rows[0].id,
    ]);
  });
  console.log("Senha alterada; todas as sessões foram encerradas.");
} finally {
  await db.close();
}
