require('dotenv').config({ path: '.env.local' })
const { Resend } = require('resend')
const resend = new Resend(process.env.RESEND_API_KEY)

async function run() {
  console.log("Sending email...")
  try {
    const res = await resend.emails.send({
      from: "notificacoes@linke.pt",
      to: "stef@linke.pt",
      subject: "Test",
      html: "<h1>Test</h1>"
    })
    console.log("Result:", res)
  } catch (e) {
    console.error("Error:", e)
  }
}
run()
