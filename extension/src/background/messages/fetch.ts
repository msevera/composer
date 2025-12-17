import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { url, method, headers, body, credentials } = req.body

  const response = await fetch(url, {
    method: method ?? 'POST',
    headers: headers ? new Headers(headers) : undefined,
    body,
    credentials: credentials ?? 'include'
  })

  const responseHeaders: [string, string][] = Array.from(response.headers.entries())
  const textBody = await response.text()

  res.send({
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: textBody,
  });
}

export default handler