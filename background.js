// Initialize context menu on install
chrome.runtime.onInstalled.addListener(() => {
  updateContextMenu();
});

// Listen for storage changes to update the context menu
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.locations || changes.mapSearchEnabled)) {
    updateContextMenu();
  }
});

// Open options page when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

async function getLocations() {
  const result = await chrome.storage.sync.get('locations');
  return result.locations || [];
}

// Update context menu items based on saved locations
async function updateContextMenu() {
  await chrome.contextMenus.removeAll();

  const locations = await getLocations();
  const { mapSearchEnabled } = await chrome.storage.sync.get('mapSearchEnabled');
  const totalItems = locations.length + (mapSearchEnabled ? 1 : 0);

  if (totalItems === 0) {
    // No locations and no map search: show "click to add" prompt
    chrome.contextMenus.create({
      id: 'quick-directions-parent',
      title: 'Get Directions From',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'no-locations',
      parentId: 'quick-directions-parent',
      title: 'No locations saved (click to add)',
      contexts: ['selection']
    });
  } else if (totalItems === 1 && !mapSearchEnabled) {
    // Single location, no map search: direct menu item
    chrome.contextMenus.create({
      id: 'location-0',
      title: `Directions from ${locations[0].name}`,
      contexts: ['selection']
    });
  } else if (totalItems === 1 && mapSearchEnabled) {
    // Map search only, no locations: direct menu item
    chrome.contextMenus.create({
      id: 'map-search',
      title: 'Search on Map',
      contexts: ['selection']
    });
  } else {
    // Multiple items: show flyout menu
    chrome.contextMenus.create({
      id: 'quick-directions-parent',
      title: 'Get Directions From',
      contexts: ['selection']
    });
    locations.forEach((location, index) => {
      chrome.contextMenus.create({
        id: `location-${index}`,
        parentId: 'quick-directions-parent',
        title: location.name,
        contexts: ['selection']
      });
    });
    if (mapSearchEnabled) {
      chrome.contextMenus.create({
        id: 'map-search',
        parentId: 'quick-directions-parent',
        title: 'Search on Map',
        contexts: ['selection']
      });
    }
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'no-locations') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (info.menuItemId === 'map-search' && info.selectionText) {
    const query = encodeURIComponent(info.selectionText.trim());
    chrome.tabs.create({ url: `https://www.google.com/maps/search/?api=1&query=${query}` });
    return;
  }

  if (info.menuItemId.startsWith('location-')) {
    const index = parseInt(info.menuItemId.replace('location-', ''), 10);
    const locations = await getLocations();
    const location = locations[index];

    if (location && info.selectionText) {
      const origin = encodeURIComponent(location.address);
      const destination = encodeURIComponent(info.selectionText.trim());
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

      chrome.tabs.create({ url: mapsUrl });
    }
  }
});
