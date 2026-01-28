// Create the parent context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'quick-directions-parent',
    title: 'Get Directions From',
    contexts: ['selection']
  });

  // Create a placeholder item if no locations are saved
  updateContextMenu();
});

// Listen for storage changes to update the context menu
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.locations) {
    updateContextMenu();
  }
});

// Open options page when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Update context menu items based on saved locations
async function updateContextMenu() {
  // Remove all menu items first
  await chrome.contextMenus.removeAll();

  // Get saved locations
  const result = await chrome.storage.sync.get('locations');
  const locations = result.locations || [];

  if (locations.length === 0) {
    // No locations: show parent with "click to add" child
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
  } else if (locations.length === 1) {
    // Single location: direct menu item, no flyout
    chrome.contextMenus.create({
      id: 'location-0',
      title: `Directions from ${locations[0].name}`,
      contexts: ['selection']
    });
  } else {
    // Multiple locations: show flyout menu
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
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'no-locations') {
    // Open options page to add locations
    chrome.runtime.openOptionsPage();
    return;
  }

  if (info.menuItemId.startsWith('location-')) {
    const index = parseInt(info.menuItemId.replace('location-', ''), 10);
    const result = await chrome.storage.sync.get('locations');
    const locations = result.locations || [];
    const location = locations[index];

    if (location && info.selectionText) {
      const origin = encodeURIComponent(location.address);
      const destination = encodeURIComponent(info.selectionText.trim());
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

      chrome.tabs.create({ url: mapsUrl });
    }
  }
});
