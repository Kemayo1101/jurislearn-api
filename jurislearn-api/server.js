const express = require("express");
const app = express();
app.use(express.json());

// CORS — autoriser tous les domaines
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin",  "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const GENIUS_BASE = "https://pay.genius.ci/api/v1/merchant";
const GENIUS_PK   = process.env.GENIUS_PK;
const GENIUS_SK   = process.env.GENIUS_SK;

const gHeaders = {
  "Content-Type": "application/json",
  "X-API-Key":    GENIUS_PK,
  "X-API-Secret": GENIUS_SK,
};

// Test — vérifier que l'API est en ligne
app.get("/", (req, res) => {
  res.json({ ok: true, service: "JurisLearn Payment API", status: "online" });
});

// POST /pay — initier un paiement
app.post("/pay", async (req, res) => {
  try {
    const { amount, description, email, name, phone, ref, payment_method, success_url, error_url } = req.body;

    if (!amount || Number(amount) < 200) {
      return res.status(400).json({ ok: false, err: "Montant minimum : 200 FCFA" });
    }

    const payload = {
      amount:      Number(amount),
      currency:    "XOF",
      description: description || "Paiement JurisLearn",
      customer: {
        name:  name  || "Étudiant JurisLearn",
        email: email || "",
        phone: phone || "",
      },
      success_url: success_url || "https://jurislearn.netlify.app",
      error_url:   error_url   || "https://jurislearn.netlify.app",
      metadata:    { site: "JurisLearn", ref, user_email: email },
    };

    if (payment_method && payment_method.trim() !== "") {
      payload.payment_method = payment_method;
    }

    const response = await fetch(`${GENIUS_BASE}/payments`, {
      method:  "POST",
      headers: gHeaders,
      body:    JSON.stringify(payload),
    });

    const data = await response.json();
    const url  = data?.data?.checkout_url || data?.data?.payment_url;

    if (data?.success && url) {
      return res.json({ ok: true, url, ref: data?.data?.reference || ref });
    }
    return res.status(400).json({
      ok:  false,
      err: data?.error?.message || data?.message || "Erreur GeniusPay"
    });

  } catch (e) {
    return res.status(500).json({ ok: false, err: "Erreur serveur : " + e.message });
  }
});

// GET /verify/:ref — vérifier un paiement
app.get("/verify/:ref", async (req, res) => {
  try {
    const reference = req.params.ref;
    const response  = await fetch(`${GENIUS_BASE}/payments/${encodeURIComponent(reference)}`, {
      headers: gHeaders,
    });
    const data   = await response.json();
    const status = data?.data?.status;
    const paid   = ["completed", "success", "paid"].includes(status);
    return res.json({ ok: true, paid, status });
  } catch (e) {
    return res.status(500).json({ ok: false, paid: false, err: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ JurisLearn Payment API — port ${PORT}`));
