'use strict'

import strings from '../strings.json' assert { type: 'json' }

document.addEventListener('DOMContentLoaded', init)

let checkboxes
let buttons

function init () {
  checkboxes = document.querySelectorAll('input[type="checkbox"]')
  buttons = document.querySelectorAll('button')

  loadStrings();
  registerListeners()
}

function loadStrings() {
  const elements = document.querySelectorAll('[data-string]');

  for (const el of elements) {
    const stringKey = el.dataset.string;
    const stringValue = strings[stringKey];
    el.innerText = stringValue;
  }
}

function registerListeners () {
  window.electronAPI.onPreferencesLoaded(loadPreferences)

  for (const checkbox of checkboxes) {
    checkbox.addEventListener('change', onCheckboxChanged)
  }

  for (const button of buttons) {
    button.addEventListener('click', onButtonClick)
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
  // Set the 'checked' property of the 'pref_open_at_login' checkbox based on the preferences data
  document.getElementById('pref_open_at_login').checked = data.pref_open_at_login

  // Enable CSS transitions after a short delay to prevent them from firing during the initial rendering of the page
  setTimeout(enableTransitions, 300)
}

function enableTransitions () {
  document.body.classList.remove('disable-transitions')
}
