require("dotenv").config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function queryD1(sql, params = []) {
  try {
    console.log("🔎 Executando Query:", sql, "com parâmetros:", params);

    const response = await fetch(process.env.D1_DATABASE_URL, {
      method: "POST",
      headers: {
        "X-Auth-Email": process.env.CLOUDFLARE_AUTH_EMAIL,
        "X-Auth-Key": process.env.CLOUDFLARE_API_KEY,
        "Authorization": `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    const data = await response.json();
    console.log("📊 Resposta D1:", JSON.stringify(data, null, 2));

    if (!response.ok || !data.success) {
      console.error("❌ Erro na consulta D1:", data.errors || "Resposta inesperada.");
      throw new Error("Erro na consulta ao banco de dados.");
    }

    // Se a resposta possuir a propriedade "result"
    if (data.hasOwnProperty("result")) {
      const res = data.result;
      // Se "res" for um array e seu primeiro elemento tiver a propriedade "results",
      // retorna esse array de resultados
      if (Array.isArray(res) && res.length > 0 && res[0].hasOwnProperty("results")) {
        return res[0].results;
      }
      return res;
    }
    return data;
  } catch (error) {
    console.error("❌ Erro ao consultar D1:", error.message);
    throw error;
  }
}

module.exports = { queryD1 };
