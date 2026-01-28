document.addEventListener('DOMContentLoaded', () => {
  loadLocations();

  document.getElementById('add-location-form').addEventListener('submit', addLocation);
});

async function loadLocations() {
  const result = await chrome.storage.sync.get('locations');
  const locations = result.locations || [];
  renderLocations(locations);
}

function renderLocations(locations) {
  const container = document.getElementById('locations-list');

  if (locations.length === 0) {
    container.innerHTML = '<p class="no-locations">No locations saved yet.</p>';
    return;
  }

  container.innerHTML = locations.map((location, index) => `
    <div class="location-item" data-index="${index}">
      <div class="location-info">
        <span class="location-name">${escapeHtml(location.name)}</span>
        <span class="location-address">${escapeHtml(location.address)}</span>
      </div>
      <div class="location-actions">
        <button class="btn btn-edit" data-index="${index}">Edit</button>
        <button class="btn btn-delete" data-index="${index}">Delete</button>
      </div>
    </div>
  `).join('');

  // Add event listeners for edit and delete buttons
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editLocation(parseInt(btn.dataset.index, 10)));
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteLocation(parseInt(btn.dataset.index, 10)));
  });
}

async function addLocation(e) {
  e.preventDefault();

  const nameInput = document.getElementById('location-name');
  const addressInput = document.getElementById('location-address');

  const name = nameInput.value.trim();
  const address = addressInput.value.trim();

  if (!name || !address) return;

  const result = await chrome.storage.sync.get('locations');
  const locations = result.locations || [];

  locations.push({ name, address });

  await chrome.storage.sync.set({ locations });

  nameInput.value = '';
  addressInput.value = '';

  loadLocations();
}

async function editLocation(index) {
  const result = await chrome.storage.sync.get('locations');
  const locations = result.locations || [];
  const location = locations[index];

  if (!location) return;

  const newName = prompt('Enter new name:', location.name);
  if (newName === null) return;

  const newAddress = prompt('Enter new address:', location.address);
  if (newAddress === null) return;

  if (newName.trim() && newAddress.trim()) {
    locations[index] = { name: newName.trim(), address: newAddress.trim() };
    await chrome.storage.sync.set({ locations });
    loadLocations();
  }
}

async function deleteLocation(index) {
  if (!confirm('Are you sure you want to delete this location?')) return;

  const result = await chrome.storage.sync.get('locations');
  const locations = result.locations || [];

  locations.splice(index, 1);

  await chrome.storage.sync.set({ locations });
  loadLocations();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
