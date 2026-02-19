document.addEventListener('DOMContentLoaded', () => {
  loadLocations();
  loadMapSearchSetting();
  document.getElementById('add-location-form').addEventListener('submit', addLocation);
  document.getElementById('map-search-enabled').addEventListener('change', saveMapSearchSetting);

  // Clear error state on input, add error on invalid
  ['location-name', 'location-address'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('input', clearError);
    input.addEventListener('invalid', addError);
  });
});

async function loadMapSearchSetting() {
  const result = await chrome.storage.sync.get('mapSearchEnabled');
  document.getElementById('map-search-enabled').checked = result.mapSearchEnabled || false;
}

async function saveMapSearchSetting() {
  await chrome.storage.sync.set({ mapSearchEnabled: this.checked });
}

function addError(e) {
  e.target.classList.add('error');
}

function clearError(e) {
  e.target.classList.remove('error');
}

let draggedItem = null;

async function getLocations() {
  const result = await chrome.storage.sync.get('locations');
  return result.locations || [];
}

async function loadLocations() {
  const locations = await getLocations();
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
      <div class="drag-handle" draggable="true" title="Drag to reorder">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5"/>
          <circle cx="3" cy="8" r="1.5"/>
          <circle cx="3" cy="13" r="1.5"/>
          <circle cx="11" cy="3" r="1.5"/>
          <circle cx="11" cy="8" r="1.5"/>
          <circle cx="11" cy="13" r="1.5"/>
        </svg>
      </div>
      <div class="location-content">
        <div class="location-view" data-index="${index}">
          <div class="location-info">
            <span class="location-name">${escapeHtml(location.name)}</span>
            <span class="location-address">${escapeHtml(location.address)}</span>
          </div>
          <div class="location-actions">
            <button class="btn btn-edit" data-index="${index}">Edit</button>
            <button class="btn btn-delete" data-index="${index}">Delete</button>
          </div>
        </div>
        <div class="location-edit" data-index="${index}" style="display: none;">
          <div class="edit-fields">
            <input type="text" class="edit-name" value="${escapeHtml(location.name)}" placeholder="Location name" required>
            <input type="text" class="edit-address" value="${escapeHtml(location.address)}" placeholder="Address" required>
          </div>
          <div class="edit-actions">
            <button class="btn btn-save" data-index="${index}">Save</button>
            <button class="btn btn-cancel" data-index="${index}">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners for edit buttons
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => showEditMode(parseInt(btn.dataset.index, 10)));
  });

  // Add event listeners for delete buttons
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteLocation(parseInt(btn.dataset.index, 10)));
  });

  // Add event listeners for save buttons
  container.querySelectorAll('.btn-save').forEach(btn => {
    btn.addEventListener('click', () => saveEdit(parseInt(btn.dataset.index, 10)));
  });

  // Add event listeners for cancel buttons
  container.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => cancelEdit(parseInt(btn.dataset.index, 10)));
  });

  // Add keyboard support and error clearing for edit fields
  container.querySelectorAll('.location-edit').forEach(editDiv => {
    const index = parseInt(editDiv.dataset.index, 10);
    editDiv.querySelectorAll('input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveEdit(index);
        } else if (e.key === 'Escape') {
          cancelEdit(index);
        }
      });
      input.addEventListener('input', clearError);
      input.addEventListener('invalid', addError);
    });
  });

  // Add drag and drop event listeners
  setupDragAndDrop(container);
}

function setupDragAndDrop(container) {
  const items = container.querySelectorAll('.location-item');
  const handles = container.querySelectorAll('.drag-handle');

  // Drag start/end on handles only
  handles.forEach(handle => {
    handle.addEventListener('dragstart', handleDragStart);
    handle.addEventListener('dragend', handleDragEnd);
  });

  // Drop targets are the full items
  items.forEach(item => {
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  const item = this.closest('.location-item');
  draggedItem = item;
  item.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', item.dataset.index);

  // Show the entire row as the drag image
  const rect = item.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  e.dataTransfer.setDragImage(item, offsetX, offsetY);
}

function handleDragEnd() {
  const item = this.closest('.location-item');
  item.classList.remove('dragging');
  clearDropIndicators();
  draggedItem = null;
}

function clearDropIndicators() {
  document.querySelectorAll('.location-item').forEach(item => {
    item.classList.remove('drop-above', 'drop-below');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  if (this === draggedItem) return;

  // Determine if cursor is in top or bottom half of the item
  const rect = this.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const isAbove = e.clientY < midpoint;

  // Clear previous indicators
  this.classList.remove('drop-above', 'drop-below');

  // Add appropriate indicator
  if (isAbove) {
    this.classList.add('drop-above');
  } else {
    this.classList.add('drop-below');
  }
}

function handleDragEnter(e) {
  e.preventDefault();
}

function handleDragLeave(e) {
  // Only remove if actually leaving the element (not entering a child)
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('drop-above', 'drop-below');
  }
}

async function handleDrop(e) {
  e.preventDefault();

  const dropAbove = this.classList.contains('drop-above');
  clearDropIndicators();

  if (this === draggedItem) return;

  const fromIndex = parseInt(draggedItem.dataset.index, 10);
  let toIndex = parseInt(this.dataset.index, 10);

  // Adjust target index based on drop position
  if (!dropAbove && fromIndex > toIndex) {
    toIndex++;
  } else if (dropAbove && fromIndex < toIndex) {
    toIndex--;
  }

  const locations = await getLocations();
  const [movedItem] = locations.splice(fromIndex, 1);
  locations.splice(toIndex, 0, movedItem);

  await chrome.storage.sync.set({ locations });
  loadLocations();
}

function showEditMode(index) {
  const viewDiv = document.querySelector(`.location-view[data-index="${index}"]`);
  const editDiv = document.querySelector(`.location-edit[data-index="${index}"]`);

  if (viewDiv && editDiv) {
    viewDiv.style.display = 'none';
    editDiv.style.display = 'flex';
    editDiv.querySelector('.edit-name').focus();
  }
}

function cancelEdit(index) {
  const viewDiv = document.querySelector(`.location-view[data-index="${index}"]`);
  const editDiv = document.querySelector(`.location-edit[data-index="${index}"]`);

  if (viewDiv && editDiv) {
    viewDiv.style.display = 'flex';
    editDiv.style.display = 'none';
  }

  // Reload to reset values
  loadLocations();
}

async function saveEdit(index) {
  const editDiv = document.querySelector(`.location-edit[data-index="${index}"]`);
  const nameInput = editDiv.querySelector('.edit-name');
  const addressInput = editDiv.querySelector('.edit-address');

  // Check validity without showing tooltip
  const nameValid = nameInput.checkValidity();
  const addressValid = addressInput.checkValidity();

  // Show error styling on invalid fields
  nameInput.classList.toggle('error', !nameValid);
  addressInput.classList.toggle('error', !addressValid);

  // Show tooltip on first invalid field only
  if (!nameValid) {
    nameInput.reportValidity();
    return;
  }
  if (!addressValid) {
    addressInput.reportValidity();
    return;
  }

  const newName = nameInput.value.trim();
  const newAddress = addressInput.value.trim();

  const locations = await getLocations();
  locations[index] = { name: newName, address: newAddress };
  await chrome.storage.sync.set({ locations });

  loadLocations();
}

async function addLocation(e) {
  e.preventDefault();

  const nameInput = document.getElementById('location-name');
  const addressInput = document.getElementById('location-address');

  const name = nameInput.value.trim();
  const address = addressInput.value.trim();

  // Show error on empty fields
  nameInput.classList.toggle('error', !name);
  addressInput.classList.toggle('error', !address);

  if (!name || !address) return;

  const locations = await getLocations();
  locations.push({ name, address });
  await chrome.storage.sync.set({ locations });

  nameInput.value = '';
  addressInput.value = '';

  loadLocations();
}

async function deleteLocation(index) {
  if (!confirm('Are you sure you want to delete this location?')) return;

  const locations = await getLocations();
  locations.splice(index, 1);
  await chrome.storage.sync.set({ locations });
  loadLocations();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
