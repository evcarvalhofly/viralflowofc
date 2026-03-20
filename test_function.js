fetch("https://dzgotqyikomtapcgdgff.supabase.co/functions/v1/viral-copy-generator", {
  method: "POST",
  headers: {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z290cXlpa29tdGFwY2dkZ2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzUxNDMsImV4cCI6MjA4Njc1MTE0M30.cTBDE0bCC6j4j2Pw0QRac220oqgQkAcYbMaJ3zyrmbY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ text: "Teste de video de gato" })
}).then(async r => {
  console.log("Status:", r.status);
  console.log("Text:", await r.text());
}).catch(console.error);
