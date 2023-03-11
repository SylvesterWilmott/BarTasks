'use strict'

const { app, Menu, Tray, BrowserWindow, dialog, nativeImage, shell, systemPreferences, ipcMain } = require('electron')

const path = require('path')
const Store = require('electron-store')
const { autoUpdater } = require('electron-updater')
const strings = require(path.join(__dirname, 'strings.json'))

const defaults = {
  tasks: [],
  completed: [],
  pref_automatically_clear: false,
  pref_sounds: true,
  pref_show_count: true,
  pref_left_click: true,
  pref_open_at_login: false,
  flag_first_launch: true
}

const storage = new Store({ defaults })

let tray
let menu
let welcomeWin
let popoverWin
let preferencesWin
const storedData = {}

app.on('ready', function () {
  app.dock.hide()
  getUserPrefs()
  setupTray()
  buildMenu()
  registerListeners()
  setupAppSettings()
  autoUpdater.checkForUpdatesAndNotify()
  showWelcomeWindowIfNeeded()

  // Prevent app from closing completely if all windows are closed
  app.on('window-all-closed', (e) => {
    e.preventDefault()
  })
})

function getUserPrefs () {
  for (const key in defaults) {
    storedData[key] = storage.get(key)
  }
}

function setupTray () {
  tray = new Tray(path.join(__dirname, 'images', 'ic_Template.png'))
}

function buildMenu () {
  const menuTemplate = []

  const addTaskTemplate = [{ label: strings.ADD_TASK_ACTION, accelerator: 'Command+N', click: () => openTaskEditor('add') }, { type: 'separator' }]
  const tasksTemplate = [...storedData.tasks.map(getTaskMenuItem), { type: 'separator' }]
  const completedTasksTemplate = [{ label: strings.COMPLETED_LIST_LABEL, enabled: false }, ...storedData.completed.map(getCompletedTaskMenuItem)]
  const clearCompletedOptionTemplate = [{ label: strings.CLEAR_COMPLETED_ACTION, accelerator: 'Command+Backspace', click: () => clearCompleted() }]
  const otherTemplate = [{ label: strings.PREFERENCES, accelerator: 'Command+,', click: () => showPreferencesWindow() }, { type: 'separator' }, { role: 'quit', accelerator: 'Command+Q' }]

  menuTemplate.push(addTaskTemplate)

  if (storedData.tasks.length) menuTemplate.push(tasksTemplate)

  // Add the "Completed Tasks" template and the "Clear Completed" option template to the menu template if there are completed tasks to display
  if (storedData.completed.length) {
    menuTemplate.push(completedTasksTemplate, { type: 'separator' })
    menuTemplate.push(clearCompletedOptionTemplate)
  } else {
    menuTemplate.push({ type: 'separator' })
  }

  menuTemplate.push(otherTemplate)

  menu = Menu.buildFromTemplate(Array.prototype.concat(...menuTemplate))
  tray.setContextMenu(menu)

  setTrayTitle()
}

function setTrayTitle () {
  const title = tray.getTitle()

  // If the user wants to show the count of tasks
  if (storedData.pref_show_count === true) {
    const taskCount = storedData.tasks.length

    // Convert the task count to a string and set it as the tray title
    const taskCountStr = taskCount > 0 ? taskCount.toString() : ''
    tray.setTitle(taskCountStr, { fontType: 'monospacedDigit' })
  } else if (title) {
    tray.setTitle('')
  }
}

function getTaskMenuItem (obj, i) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, 'images', 'ic_checkbox_unchecked_Template.png')
  )

  const menuItem = {
    label: obj.title,
    toolTip: obj.text,
    icon
  }

  // If left-click is not preferred, add the submenu to the task menu item
  if (storedData.pref_left_click === false) {
    let clickHandlerTemplate

    if (storedData.pref_automatically_clear === true) {
      clickHandlerTemplate = () => {
        deleteTask('task', i)
      }
    } else {
      clickHandlerTemplate = () => {
        completeTask(i)
      }
    }

    const submenuTemplate = [
      {
        label: strings.MARK_COMPLETE,
        click: clickHandlerTemplate
      },
      { type: 'separator' },
      {
        label: strings.EDIT,
        click: () => editTask(i)
      },
      {
        label: strings.DELETE,
        click: () => deleteTask('task', i)
      }
    ]

    menuItem.submenu = submenuTemplate
  } else {
    // Otherwise, add the click event handler to the task menu item
    let clickHandlerTemplate

    if (storedData.pref_automatically_clear === true) {
      clickHandlerTemplate = (menuItem, win, e) => {
        if (e.metaKey) {
          editTask(i)
        } else if (e.shiftKey) {
          deleteTask('task', i)
        } else {
          deleteTask('task', i)
        }
      }
    } else {
      clickHandlerTemplate = (menuItem, win, e) => {
        if (e.metaKey) {
          editTask(i)
        } else if (e.shiftKey) {
          deleteTask('task', i)
        } else {
          completeTask(i)
        }
      }
    }

    menuItem.click = clickHandlerTemplate
  }

  return menuItem
}

function getCompletedTaskMenuItem (obj, i) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, 'images', 'ic_checkbox_checked_Template.png')
  )

  const menuItem = {
    label: obj.title,
    toolTip: obj.text,
    enabled: false,
    icon
  }

  return menuItem
}

function openTaskEditor (mode, toEdit) {
  if (popoverWin) {
    popoverWin.show()

    if (mode === 'edit') {
      const taskText = storedData.tasks[toEdit].text
      popoverWin.webContents.send('editTask', {
        index: toEdit,
        text: taskText
      })
    }

    return
  }

  popoverWin = new BrowserWindow({
    width: 680,
    height: 52,
    vibrancy: 'sidebar',
    fullscreenable: false,
    resizable: false,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    hiddenInMissionControl: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true
    }
  })

  preventZoom(popoverWin)

  popoverWin.loadFile(path.join(__dirname, 'popover', 'popover.html'))

  popoverWin.once('ready-to-show', () => {
    popoverWin.setWindowButtonVisibility(false)
    popoverWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    popoverWin.show()

    // Position the window vertically off-center to mimic the position of spotlight search
    const position = popoverWin.getPosition()
    const newYPosition = Math.floor(position[1] / 2.8)
    popoverWin.setPosition(position[0], newYPosition)

    popoverWin.on('blur', () => {
      popoverWin.hide()
      popoverWin.webContents.send('resetWin')
    })
  })

  popoverWin.webContents.on('did-finish-load', () => {
    if (mode === 'edit') {
      const taskText = storedData.tasks[toEdit].text
      popoverWin.webContents.send('editTask', {
        index: toEdit,
        text: taskText
      })
    }
  })
}

// Moves a task from 'tasks' to 'completed' array in the storage object
function completeTask (i) {
  if (i > -1) {
    const updatedTasks = [...storedData.tasks]
    const updatedCompleted = [...storedData.completed]
    updatedCompleted.unshift(updatedTasks[i]) // add completed task to the beginning of 'completed' array
    storage.set('completed', updatedCompleted) // update 'completed' array in storage
    updatedTasks.splice(i, 1) // remove task from 'tasks' array
    storage.set('tasks', updatedTasks) // update 'tasks' array in storage
    if (storedData.pref_sounds === true) playSound()
  }
}

// Opens the task editor for editing a task with index 'i'
function editTask (i) {
  if (i > -1) {
    openTaskEditor('edit', i)
  }
}

// Deletes a task or a completed task based on 'type' and index 'i'
function deleteTask (type, i) {
  if (i > -1) {
    if (type === 'task') {
      const updatedTasks = [...storedData.tasks]
      updatedTasks.splice(i, 1) // remove task from 'tasks' array
      storage.set('tasks', updatedTasks) // update 'tasks' array in storage
    } else if (type === 'completed') {
      const updatedCompleted = [...storedData.completed]
      updatedCompleted.splice(i, 1) // remove completed task from 'completed' array
      storage.set('completed', updatedCompleted) // update 'completed' array in storage
    }
  }
}

// Clears all completed tasks
function clearCompleted () {
  const updatedCompleted = []
  storage.set('completed', updatedCompleted)
}

// Clears all tasks and completed tasks
function clearAll (winId) {
  if (storedData.tasks.length === 0 && storedData.completed.length === 0) return

  let parentWindow = null
  if (winId) parentWindow = BrowserWindow.fromId(winId)

  dialog
    .showMessageBox(parentWindow, {
      message: strings.CLEAR_QUESTION_TITLE,
      detail: strings.CLEAR_QUESTION_DETAIL,
      buttons: [strings.CLEAR_QUESTION_BUTTON_POSITIVE, strings.CLEAR_QUESTION_BUTTON_NEGATIVE],
      type: 'warning',
      defaultId: 1,
      cancelId: 1
    })
    .then((result) => {
      if (result.response === 0) {
        const updatedTasks = []
        const updatedCompleted = []
        storage.set('tasks', updatedTasks) // update 'tasks' array in storage
        storage.set('completed', updatedCompleted) // update 'completed' array in storage
        if (storedData.pref_sounds === true) playSound()
      }
    })
    .catch((err) => {
      console.log(err)
    })
}

function registerListeners () {
  // Listens for when a new task is created from popover renderer
  ipcMain.on('addTask', (e, task) => {
    const updatedTasks = [...storedData.tasks]
    updatedTasks.unshift(task)
    storage.set('tasks', updatedTasks)
    if (storedData.pref_sounds === true) playSound()
  })

  // Listens for when an existing task is edited in popover renderer
  ipcMain.on('updateTask', (e, data) => {
    const updatedTasks = [...storedData.tasks]

    if (data.index !== -1) {
      updatedTasks[data.index] = data.task
      storage.set('tasks', updatedTasks)
    }
  })

  // Listens for any change to preferences from renderers
  ipcMain.on('updatePreferences', (e, data) => {
    const key = data.key
    const value = data.value

    storage.set(key, value)
  })

  ipcMain.on('rendererButtonClicked', (e, data) => {
    const id = data

    switch (id) {
      case 'clear_all':
        clearAll(e.sender.id)
        break
      case 'close_welcome_window':
        if (welcomeWin) {
          welcomeWin.close()
          welcomeWin = null
        }
        break
    }
  })

  // Listens for when the popover renderer is closed
  ipcMain.on('closeWindow', () => {
    if (popoverWin) popoverWin.hide()
    popoverWin.webContents.send('resetWin')
  })

  storage.onDidAnyChange((result) => {
    for (const key in defaults) {
      storedData[key] = result[key]
    }
  })

  storage.onDidChange('tasks', () => {
    buildMenu() // Rebuild menu to update task list
  })

  storage.onDidChange('completed', () => {
    buildMenu()
  })

  storage.onDidChange('pref_left_click', () => {
    buildMenu() // Rebuild menu to update menu ui
  })

  storage.onDidChange('pref_open_at_login', (value) => {
    setLoginSettings(value)
  })

  storage.onDidChange('pref_show_count', () => {
    setTrayTitle() // Toggle title
  })

  // Subscribe to system preference changes for accent color and update window accent color
  systemPreferences.subscribeNotification(
    'AppleAquaColorVariantChanged',
    () => {
      setTimeout(() => {
        const accentColor = getAccentColor()
        if (welcomeWin) welcomeWin.webContents.send('updateAccentColor', accentColor)
        if (preferencesWin) preferencesWin.webContents.send('updateAccentColor', accentColor)
      }, 250)
    }
  )
}

function setupAppSettings () {
  const openAtLoginStatus = app.getLoginItemSettings().openAtLogin

  // If the stored preference for opening at login is different from the current status, update it
  if (openAtLoginStatus !== storedData.pref_open_at_login) {
    setLoginSettings(storedData.pref_open_at_login)
  }
}

function setLoginSettings (status) {
  app.setLoginItemSettings({
    openAtLogin: status
  })
}

function getAccentColor () {
  const hexRgba = systemPreferences.getAccentColor()

  if (hexRgba) {
    return hexRgba.slice(0, -2)
  } else {
    return null
  }
}

function playSound () {
  shell.beep()
}

function showWelcomeWindowIfNeeded () {
  // check if the application is being launched for the first time
  if (storedData.flag_first_launch === false) return

  // then update the flag
  storage.set('flag_first_launch', false)

  welcomeWin = new BrowserWindow({
    width: 380,
    height: 500,
    vibrancy: 'window',
    fullscreenable: false,
    resizable: false,
    frame: false,
    show: false,
    alwaysOnTop: true,
    minimizable: false,
    hiddenInMissionControl: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true
    }
  })

  preventZoom(welcomeWin)

  welcomeWin.loadFile(path.join(__dirname, 'welcome', 'welcome.html'))

  welcomeWin.once('ready-to-show', () => {
    welcomeWin.show()
  })

  welcomeWin.on('closed', () => {
    welcomeWin = null
  })

  welcomeWin.webContents.on('did-finish-load', () => {
    const accentColor = getAccentColor()
    if (accentColor) {
      welcomeWin.webContents.send('updateAccentColor', accentColor)
    } // If no accent color then send nothing / theme.css will take care of the fallback
    welcomeWin.webContents.send('loadPreferences', storedData)
  })

  welcomeWin.on('blur', () => {
    welcomeWin.webContents.send('stateChange', 'blur')
  })

  welcomeWin.on('focus', () => {
    welcomeWin.webContents.send('stateChange', 'focus')
  })
}

function showPreferencesWindow () {
  if (preferencesWin) {
    preferencesWin.show()
    return
  }

  preferencesWin = new BrowserWindow({
    width: 400,
    height: 313,
    vibrancy: 'window',
    titleBarStyle: 'hidden',
    fullscreenable: false,
    resizable: false,
    alwaysOnTop: true,
    minimizable: false,
    hiddenInMissionControl: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true
    }
  })

  preventZoom(preferencesWin)

  preferencesWin.loadFile(path.join(__dirname, 'preferences', 'preferences.html'))

  preferencesWin.once('ready-to-show', () => {
    preferencesWin.show()
  })

  preferencesWin.on('closed', () => {
    preferencesWin = null
  })

  preferencesWin.webContents.on('did-finish-load', () => {
    const accentColor = getAccentColor()
    if (accentColor) {
      preferencesWin.webContents.send('updateAccentColor', accentColor)
    } // theme.css handles fallback defaults
    preferencesWin.webContents.send('loadPreferences', storedData)
  })

  preferencesWin.on('blur', () => {
    preferencesWin.webContents.send('stateChange', 'blur')
  })

  preferencesWin.on('focus', () => {
    preferencesWin.webContents.send('stateChange', 'focus')
  })
}

function preventZoom (win) {
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === '=' || input.key === '-') && (input.control || input.meta)) {
      e.preventDefault()
    }
  })
}
