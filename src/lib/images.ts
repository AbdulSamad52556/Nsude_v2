/**
 * Central image registry. Swap any URL here with real NSUDE photography
 * without touching component code.
 */
function unsplash(id: string, w = 1400, q = 80) {
  return `https://images.unsplash.com/photo-${id}?w=${w}&q=${q}&auto=format&fit=crop`;
}

export const campaignImages = {
  brandStatementBg: unsplash("1550246140-29f40b909e5a", 1800),
  collectionCampaign: unsplash("1519638399535-1b036603ac77", 2000),
  aboutHero: unsplash("1509631179647-0177331693ae", 1800),
  aboutSecondary: unsplash("1560243563-062bfc001d68", 1400),
  philosophy: unsplash("1594633313593-bab3825d0caf", 1400),
  fitRelaxed: unsplash("1617137968427-85924c800a22", 1400),
  fitRegular: unsplash("1516762689617-e1cffcef479d", 1400),
  fitOversized: unsplash("1591369822096-ffd140ec948f", 1400),
};

export const productImagePool = [
  unsplash("1521572163474-6864f9cf17ab"),
  unsplash("1441986300917-64674bd600d8"),
  unsplash("1490578474895-699cd4e2cf59"),
  unsplash("1500648767791-00dcc994a43e"),
  unsplash("1503341504253-dff4815485f1"),
  unsplash("1594938298603-c8148c4dae35"),
  unsplash("1602810318383-e386cc2a3ccf"),
  unsplash("1571945153237-4929e783af4a"),
  unsplash("1552374196-c4e7ffc6e126"),
  unsplash("1618354691373-d851c5c3a990"),
  unsplash("1583743814966-8936f5b7be1a"),
  unsplash("1489987707025-afc232f7ea0f"),
  unsplash("1487222477894-8943e31ef7b2"),
  unsplash("1552346154-21d32810aba3"),
  unsplash("1523381210434-271e8be1f52b"),
  unsplash("1516826957135-700dedea698c"),
  unsplash("1622445275463-afa2ab738c34"),
  unsplash("1622470953794-aa9c70b0fb9d"),
  unsplash("1620799140408-edc6dcb6d633"),
  unsplash("1544441893-675973e31985"),
  unsplash("1519085360753-af0119f7cbe7"),
  unsplash("1445205170230-053b83016050"),
  unsplash("1521572267360-ee0c2909d518"),
  unsplash("1490578474895-699cd4e2cf59", 1400, 75),
];
