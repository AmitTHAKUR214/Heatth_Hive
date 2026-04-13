export const exportChatAsPDF = (messages, participants) => {
  const [userA, userB] = participants;
  const printWindow = window.open("", "_blank");

  const rows = messages.map(m => {
    const sender   = m.sender?.name || "Unknown";
    const time     = new Date(m.createdAt).toLocaleString("en-IN");
    const text = m.text || "";
    const files = Array.isArray(m.attachments) && m.attachments.length > 0
      ? m.attachments.map(a => `📎 ${a?.name || "attachment"}`).join("<br>")
      : "";
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;white-space:nowrap">${time}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${sender}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${text}${files}</td>
      </tr>`;
  }).join("");

  printWindow.document.write(`
    <!DOCTYPE html><html><head>
    <title>Chat Export — ${userA?.name} & ${userB?.name}</title>
    <style>
      body { font-family: sans-serif; padding: 32px; color: #1e293b; }
      h1   { font-size: 20px; margin-bottom: 4px; }
      p    { color: #64748b; font-size: 13px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th   { text-align: left; padding: 10px 8px; background: #f8fafc;
             border-bottom: 2px solid #e2e8f0; font-size: 12px; color: #64748b; }
      tr:hover td { background: #f8fafc; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>
    <h1>💬 Conversation Export</h1>
    <p>Between ${userA?.name} (@${userA?.username}) and ${userB?.name} (@${userB?.username})
       · Exported ${new Date().toLocaleString("en-IN")}
       · ⚠️ Messages auto-delete after 24 hours of inactivity</p>
    <table>
      <thead><tr><th>Time</th><th>Sender</th><th>Message</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload = () => { window.print(); window.close(); }<\/script>
    </body></html>
  `);
  printWindow.document.close();
};