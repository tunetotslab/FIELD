const token = process.env.FIELD_BOT_TOKEN;
const api = `https://api.telegram.org/bot${token}`;
if (!token) throw new Error('Set FIELD_BOT_TOKEN in the shell; never commit it.');
const commands = {
  en: [['start','Open FIELD'],['open','Open FIELD'],['daily','Daily Sound'],['donate','Donate'],['about','About FIELD'],['help','How to FIELD'],['links','Links'],['language','Language'],['paysupport','Payment support']],
  ru: [['start','Открыть FIELD'],['open','Открыть FIELD'],['daily','Звук дня'],['donate','Донат'],['about','О FIELD'],['help','Как пользоваться FIELD'],['links','Ссылки'],['language','Язык'],['paysupport','Поддержка платежей']],
  hy: [['start','Բացել FIELD'],['open','Բացել FIELD'],['daily','Օրվա ձայնը'],['donate','Նվիրատվություն'],['about','FIELD-ի մասին'],['help','Ինչպես օգտագործել FIELD'],['links','Հղումներ'],['language','Լեզու'],['paysupport','Վճարումների աջակցություն']],
  'zh-TW': [['start','開啟 FIELD'],['open','開啟 FIELD'],['daily','每日聲音'],['donate','贊助'],['about','關於 FIELD'],['help','FIELD 使用方式'],['links','連結'],['language','語言'],['paysupport','付款支援']],
};
for (const [language_code, list] of Object.entries(commands)) {
  const response = await fetch(`${api}/setMyCommands`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ commands: list.map(([command, description]) => ({command, description})), scope: {type: 'all_private_chats'}, language_code }) });
  if (!response.ok) throw new Error(`setMyCommands failed for ${language_code}: ${await response.text()}`);
}
console.log('FIELD localized bot commands registered.');
