'use strict'

import strings from '../strings.json' assert { type: 'json' }

document.addEventListener('DOMContentLoaded', init)

let titleBar
let tabs
let checkboxes
let buttons

function init () {
  titleBar = document.getElementById('titleBar')
  tabs = document.querySelectorAll('.tab')
  checkboxes = document.querySelectorAll('input[type="checkbox"]')
  buttons = document.querySelectorAll('button')

  loadStrings();
  registerListeners()
  selectFirstTab()
}

function loadStrings() {
  const elements = document.querySelectorAll('[data-string]');

  for (const el of elements) {
    const stringKey = el.dataset.string;
    const stringValue = strings[stringKey];
    el.innerText = stringValue;
  }
}

function selectFirstTab () {
  tabs[0].click()
}

function registerListeners () {
  // Register a listener for when the preferences are loaded
  window.electronAPI.onPreferencesLoaded(loadPreferences)

  for (const tab of tabs) {
    tab.addEventListener('click', onTabClicked)
  }

  for (const checkbox of checkboxes) {
    checkbox.addEventListener('change', onCheckboxChanged)
  }

  for (const button of buttons) {
    button.addEventListener('click', onButtonClick)
  }
}

function onTabClicked (e) {
  const targetEl = e.target

  if (targetEl.classList.contains('tab')) {
    const sectionName = targetEl.dataset.section

    // Update the title bar with the name of the selected section
    titleBar.innerText = sectionName

    if (sectionName) {
      clearAllSelections()

      // Find all elements with a `data-section` attribute matching the selected section name and make them active
      const targetSelection = document.querySelectorAll(
        `[data-section="${sectionName}"]`
      )

      for (const el of targetSelection) {
        el.classList.add('active')
      }
    }
  } else {
    // If the target element is not a tab, find the nearest ancestor with a `tab` class and trigger a click it
    const ancestor = targetEl.closest('.tab')

    if (ancestor) {
      ancestor.click()
    }
  }
}

function clearAllSelections () {
  const allSections = document.querySelectorAll('[data-section]')

  for (const el of allSections) {
    el.classList.remove('active')
  }
}

function onCheckboxChanged (e) {
  // Send a message to the main process to update the preferences
  window.electronAPI.send('updatePreferences', {
    key: e.target.id,
    value: e.target.checked
  })
}

function onButtonClick (e) {
  // Send a message to the main process indicating that a button was clicked
  window.electronAPI.send('rendererButtonClicked', e.target.id)
}

function loadPreferences (e, data) {

  // Set toggles
  for (const p in data) {
    if (typeof data[p] === "boolean" && p.match(/pref_.*/gm)) {
      const el = document.getElementById(p);
      if (el) {
        el.checked = data[p]
      }
    }
  }

  // Enable CSS transitions after a short delay to prevent them from firing during the initial rendering of the page
  setTimeout(enableTransitions, 300)
}

function enableTransitions () {
  document.getElementById('main').classList.remove('disable-transitions')
}
