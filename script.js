'use strict'

const colormap = {
  'red': '#ff4d4d',
  'amber': '#ffbf4d',
  'yellow': '#ffff80',
  'green': '#80ff80'
}

const datePickerOptions = {
  showWeek: true,
  changeMonth: true,
  changeYear: true,
  dateFormat: 'd M yy',
  showButtonPanel: true,
  showOn: 'button',
  showOtherMonths: true,
  selectOtherMonths: true,
  firstDay: 1
}

function buildAvailabilityURL (site, profile, group) {
  var url = [
    `http://wlcg-sam-${site}.cern.ch/`,
    'dashboard/request.py/getstatsresultsmin?',
    `&profile_name=${profile}`,
    `&group_name=${group}`,
    '&granularity=daily',
    '&view=siteavl'
  ].join('')
  return url
}

const availabilityURLs = {
  'Atlas': buildAvailabilityURL('atlas', 'ATLAS_CRITICAL', 'RAL-LCG2'),
  'Atlas-Echo': buildAvailabilityURL('atlas', 'ATLAS_CRITICAL', 'RAL-LCG2-ECHO'),
  'CMS': buildAvailabilityURL('cms', 'CMS_CRITICAL', 'T1_UK_RAL'),
  'LHCB': buildAvailabilityURL('lhcb', 'LHCb_CRITICAL', 'LCG.RAL.uk'),
  'Alice': buildAvailabilityURL('alice', 'ALICE_CRITICAL', 'RAL'),
  'OPS': ' http://argo.egi.eu/lavoisier/site_ar?' +
    'site=RAL-LCG2' +
    '&cr=1' +
    '&report=Critical' +
    '&granularity=DAILY' +
    '&accept=json'
}

function headerFilter (header) {
  var filters = [
    'affected_site',
    'responsible_unit',
    'ticket_type'
  ]
  return !filters.includes(header)
}

function submit () {
  var searchType = document.forms[0].search_type.value
  let warnings = document.getElementById("warnings")
  while (warnings.firstChild) {
    warnings.removeChild(warnings.firstChild);
  }
  console.log(searchType)
  switch (searchType) {
    case 'opened':
      ticketSearch('opened')
      break
    case 'closed_lastweek':
      ticketSearch('closed_lastweek')
      break
    case 'closed':
      var fromDate = document.forms[1].from_date.value
      var toDate = document.forms[1].to_date.value
      if (isNaN(new Date(fromDate)) || isNaN(new Date(toDate))) {
        return alert('Invalid date input')
      }
      var timeframe = [fromDate.split(' ').join('+'), toDate.split(' ').join('+')]
      ticketSearch('closed', timeframe)
      break
    case 'availabilities_lastweek':
      var today = new Date().getTime()
      var yesterday = new Date(today - (1000 * 60 * 60 * 24))
      var lastweek = new Date(today - (1000 * 60 * 60 * 24 * 7))
      availabilitySearch(lastweek, yesterday)
      break
    case 'availabilities':
      var inputFromDate = new Date(document.forms[1].from_date.value).getTime()
      var inputToDate = new Date(document.forms[1].to_date.value).getTime()
      // Both days are skewed by one
      fromDate = new Date(inputFromDate + (1000 * 60 * 60 * 24))
      toDate = new Date(inputToDate + (1000 * 60 * 60 * 24))
      if (isNaN(fromDate) || isNaN(toDate)) {
        return alert('Invalid date input')
      }
      availabilitySearch(fromDate, toDate)
      break
  }
}

function ticketSearch (searchType, timeFrame = []) {
  var urlSuffix = {
    'opened': [
      '&status=open',
      'date_type=creation+date',
      'tf_radio=1',
      'timeframe=any'
    ].join('&'),
    'closed_lastweek': [
      '&status=terminal',
      'date_type=closing+date',
      'tf_radio=1',
      'timeframe=lastweek'
    ].join('&'),
    'closed': [
      '&status=terminal',
      'date_type=closing+date',
      'tf_radio=2',
      `from_date=${timeFrame[0]}`,
      `to_date=${timeFrame[1]}`
    ].join('&')
  }[searchType]

  var urlPrefix = [
    'https://ggus.eu/?mode=ticket_search',
    'affectedsite=RAL-LCG2',
    'writeFormat=XML',
    'search_submit=GO%21',
    'orderticketsby=REQUEST_ID',
    'orderhow=desc'
  ].join('&')

  var url = urlPrefix + urlSuffix
  console.log(url)

  document.getElementById('loading_gif').style.display = 'block'
  var xhr = new XMLHttpRequest()
  xhr.open('GET', url)
  xhr.withCredentials = true
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
      console.log(xhr.responseText)
      var xmlParser = new DOMParser()
      var xml = xmlParser.parseFromString(xhr.responseText, 'text/xml')
      console.log(xml)

      // Clear previous table if exists
      var table = document.getElementById('mainTable')
      while (table.firstChild) { table.removeChild(table.firstChild) }

      if (xml.childNodes[0].childNodes.length === 0) {
        table.textContent = 'No data.'
        document.getElementById('loading_gif').style.display = 'none'
        return
      }

      // Append headers as <th>
      var headers = Array.prototype.slice.call(xml.childNodes[0].childNodes[0].childNodes)
        .reduce((headers, header) => {
          headers.push(header.nodeName)
          return headers
        }, [])
        .filter(headerFilter)
      var row = document.createElement('tr')

      for (let header of headers) {
        if (header === 'priority_color') { continue }
        let item = document.createElement('th')
        item.textContent = header[0].toUpperCase()
        item.textContent += header.split('_').join(' ').slice(1)
        row.appendChild(item)
      }
      table.appendChild(row)

      // Append each ticket
      for (let ticket of xml.childNodes[0].childNodes) {
        console.log(ticket)
        row = document.createElement('tr')
        for (let header of headers) {
          let value = ticket.getElementsByTagName(header)[0].textContent

          // 'priority_color' no longer supplied by GGUS xmls, this block is no longer functional
          // Apply colours to ticket IDs
          // if (header === 'priority_color') {
          //   console.log('color: ', value)
          //   let color = colormap[value]
          //   row.firstChild.setAttribute('style', `background-color: ${color}`)
          //   continue
          // }

          // Filter time from dates
          if (header === 'date_of_creation' || header === 'last_update') {
            let date = new Date(value)
            value = date.toLocaleDateString('en-gb')
          }

          let item = document.createElement('td')
          item.textContent = value
          row.appendChild(item)
        }
        table.appendChild(row)
      }
      document.getElementById('loading_gif').style.display = 'none'
    } else {
      document.getElementById('mainTable').textContent = 'Request error'
      document.getElementById('loading_gif').style.display = 'none'
    }
  }
  xhr.send()
}

function appendAvailability (urls) {

  document.getElementById('loading_gif').style.display = 'block'
  var table = document.getElementById('mainTable')
  if (urls.length === 0) {
    for (let row of table.childNodes) {
      var item
      if (row.childNodes[0].textContent === 'Day') {
        item = document.createElement('th')
        item.textContent = 'Comments'
      } else {
        item = document.createElement('td')
      }
      row.appendChild(item)
    }
    document.getElementById('loading_gif').style.display = 'none'
    return
  }

  var isOPS = urls[0][0] === 'OPS'
  var xhr = new XMLHttpRequest()

  xhr.open('GET', urls[0][1])
  xhr.onload = () => {
    console.log(urls[0][0], "xhr", xhr.status)
    if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
      var json = JSON.parse(xhr.responseText)
      console.log(json)
      if (json.data[0])
      {
        var days = []
        if (isOPS) {
          json.entries[0].Entity.map(day => days.push(day.timestamp))
        }
        else {
          json.data[0].data.map(day => days.push(day.date.split('/').join('-')))
        }
        days = days.sort()
        // Create each row if not done yet
        if (table.childElementCount === 1) {
          for (let day of days) {
            let row = document.createElement('tr')
            item = document.createElement('td')
            item.textContent = day
            row.appendChild(item)
            table.appendChild(row)
          }
        }

        var title = document.createElement('th')
        title.textContent = urls[0][0]
        table.childNodes[0].appendChild(title)

        var dayMap = day => {
          var dayID = day.timestamp
          if (!isOPS) { dayID = day.date.split('/').join('-') }
          for (let row of table.childNodes) {
            if (row.childNodes[0].textContent === dayID) {
              item = document.createElement('td')
              item.textContent = day.availability
              if (!isOPS) { item.textContent = String(day.OK * 100) }
              row.appendChild(item)
              break
            }
          }
        }

        if (isOPS) {
          json.entries[0].Entity.map(dayMap)
        }
        else {
          json.data[0].data.map(dayMap)
        }

        urls = urls.slice(1)
        appendAvailability(urls)
      }
      else
      {
        noDataWarning(urls)
      }

    } else {
      console.error(xhr)
      noDataWarning(urls)
    }
  }
  xhr.send()
}

function noDataWarning(urls)
{
  let warning = document.getElementById('warnings')
  let item = document.createElement('div')
  item.textContent = urls[0][0] + " not returning data!"
  warning.appendChild(item)
  warning.style.display = 'block'
  urls = urls.slice(1)
  appendAvailability(urls)
}

function availabilitySearch (fromDate, toDate) {
  var startTime = fromDate.toISOString().split('.')[0] + 'Z'
  var endTime = toDate.toISOString().split('.')[0] + 'Z'
  // .split(".")[0]+"Z" removes milliseconds
  var startDate = startTime.slice(0, 10)
  var endDate = endTime.slice(0, 10)

  var urls = []
  for (let vo in availabilityURLs) {
    if (vo === 'OPS') {
      urls.push([
        'OPS',
        availabilityURLs['OPS'] + `&start_date=${startDate}` + `&end_date=${endDate}`
      ])
    } else {
      urls.push([
        vo,
        availabilityURLs[vo] + `&start_time=${startTime}` + `&end_time=${endTime}`
      ])
    }
  }

  // Clear previous table if exists
  var table = document.getElementById('mainTable')
  while (table.firstChild) table.removeChild(table.firstChild)

  // Create first row / column
  var row = document.createElement('tr')
  var item = document.createElement('th')
  item.textContent = 'Day'
  row.appendChild(item)
  table.appendChild(row)

  console.log(urls)
  appendAvailability(urls)
}

function wikiConvert () {
  var table = document.getElementById('mainTable')
  var textarea = document.getElementById('mainTextarea')
  textarea.style.display = 'block'
  textarea.value = '{| border=1 align=center\n'
  textarea.value += '|- bgcolor="#7c8aaf"\n'
  for (let header of table.children[0].children) {
    textarea.value += `! ${header.textContent}\n`
  }
  for (let i = 1; i < table.childElementCount; i++) {
    textarea.value += '|-\n'
    for (let item of table.children[i].children) {
      textarea.value += `| ${item.textContent}\n`
    }
  }
  textarea.value += '|}'
}

function getDate (element) {
  try {
    return $.datepicker.parseDate('d M yy', element.value)
  } catch (error) {
    return null
  }
}

$(function () {
  var fromDate = document.forms[1].from_date
  var toDate = document.forms[1].to_date

  var $from = $(fromDate).datepicker(datePickerOptions)
    .on('change', function () {
      $to.datepicker('option', 'minDate', getDate(this))
    })
  var $to = $(toDate).datepicker(datePickerOptions)
    .on('change', function () {
      $from.datepicker('option', 'maxDate', getDate(this))
    })
})
