'use strict'

document.addEventListener('DOMContentLoaded', init)

let styleEl

function init () {
  registerListeners()
}

function registerListeners () {
  window.electronAPI.onAccentColorChanged(updateAccentColor)
  window.electronAPI.onWindowStateChanged(handleWindowStateChange)
}

function updateAccentColor (e, color) {
  // If no color is specified, return early
  // Fallback is handled in theme.css
  if (!color) return

  if (styleEl) styleEl.remove()

  // Create a new <style> element and append it to the <head> of the document
  styleEl = document.createElement('style')
  document.head.appendChild(styleEl)

  const styleSheet = styleEl.sheet
  const variableRule = `:root { --accent: #${color}; }`

  styleSheet.insertRule(variableRule, styleSheet.cssRules.length)
}

function handleWindowStateChange (e, state) {
  if (state === 'blur') {
    document.body.style.filter = 'grayscale(100%)'
    document.body.style.opacity = 0.75
  } else if (state === 'focus') {
    document.body.style.filter = 'none'
    document.body.style.opacity = 1
  }
}
