'use strict'

import * as icons from './icons.js'
import strings from '../strings.json' assert { type: 'json' }

document.addEventListener('DOMContentLoaded', init)

let form
let input
let submit
let mode = 'add' // current mode, either "add" or "edit"
let toEdit // index of the task to edit
const maxChars = 45 // Maximum number of chartacters for task title

function init () {
  form = document.getElementById('taskForm')
  input = document.getElementById('taskInput')
  submit = document.getElementById('submit')

  loadStrings();
  registerListeners()

  input.focus()
}

function loadStrings() {
  input.placeholder = strings.ADD_TASK_ACTION
}

function registerListeners () {
  input.addEventListener('input', onInputInput)
  form.addEventListener('submit', onFormSubmit)
  window.addEventListener('keydown', onWindowKeydown)

  window.electronAPI.onWindowClose(resetWindow)
  window.electronAPI.onTaskEdit(enterEditMode)
}

function onFormSubmit (e) {
  e.preventDefault()

  const value = input.value

  // If input is empty, return and do nothing
  if (!value) return

  const title = truncate(value)

  const taskObject = {
    title,
    text: value
  }

  // If mode is "add", send a message to add the task
  // If mode is "edit", send a message to update the task with the given index
  if (mode === 'add') {
    window.electronAPI.send('addTask', taskObject)
  } else if (mode === 'edit') {
    window.electronAPI.send('updateTask', { task: taskObject, index: toEdit })
  }

  closeWindow()
}

function onInputInput () {
  const value = input.value

  // If input has a value, make the window not draggable
  if (value) {
    input.classList.add('not-draggable')
    submit.style.opacity = '1'
  } else {
    input.classList.remove('not-draggable')
    submit.style.opacity = '0'
  }
}

function truncate (str) {
  const trimmed = str.trim()

  // truncate the string and add ellipsis
  return trimmed.length > maxChars
    ? `${trimmed.slice(0, maxChars)}...`
    : trimmed
}

function onWindowKeydown (e) {
  if (e.key === 'Escape') {
    closeWindow()
  }
}

function closeWindow () {
  window.electronAPI.send('closeWindow')
}

function resetWindow () {
  mode = 'add'
  toEdit = undefined
  input.value = ''
  submit.style.opacity = '0'
  submit.innerHTML = icons.add // Update icon to default "+"
}

function enterEditMode (e, data) {
  mode = 'edit'
  toEdit = data.index
  input.value = data.text
  submit.innerHTML = icons.edit // Update icon to "pen"
}
