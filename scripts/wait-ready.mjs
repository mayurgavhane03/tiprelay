const deadline = Date.now() + 60000;
let ready = false;
while (Date.now() < deadline) {
  try {
    ready =
      (await fetch('http://127.0.0.1:3001/health')).ok && (await fetch('http://127.0.0.1:5173')).ok;
    if (ready) break;
  } catch {
    /* Server is starting. */
  }
  await new Promise((r) => setTimeout(r, 500));
}
if (!ready) throw new Error('Local servers did not become ready');
