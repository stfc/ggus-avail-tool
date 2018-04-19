colormap = {
    "red": "#ff4d4d",
    "amber": "#ffbf4d",
    "yellow": "#ffff80",
    "green": "#80ff80"
}

datePickerOptions = {
    showWeek: true,
    changeMonth: true,
    changeYear: true,
    dateFormat: "d M yy",
    showButtonPanel: true,
    showOn: "button",
    showOtherMonths: true,
    selectOtherMonths: true,
    firstDay: 1
}

function headerFilter(header) {
    filters = [
        "affected_site",
        "responsible_unit",
        "ticket_type",
    ]
    return !(filters.indexOf(header) >= 0)
}

function submit() {
    search_type = document.forms[0].search_type.value
    console.log(search_type)
    if (search_type == "opened") {
        ticketSearch(
            "/ggus_tool/ggus/?" +
            "&status=open" +
            "&date_type=creation+date" +
            "&tf_radio=1" +
            "&timeframe=any"
        )
    } else if (search_type == "closed_lastweek") {
        ticketSearch(
            "/ggus_tool/ggus/?" +
            "&status=terminal" +
            "&date_type=closing+date" +
            "&tf_radio=1" +
            "&timeframe=lastweek"
        )
    } else if (search_type == "closed") {
        from_date = document.forms[1].from_date.value
        to_date = document.forms[1].to_date.value
        if (new Date(from_date) == "Invalid Date" || new Date(to_date) == "Invalid Date")
            return alert("Invalid date input")
        ticketSearch(
            "/ggus_tool/ggus/?" +
            "&status=terminal" +
            "&date_type=closing+date" +
            "&tf_radio=2" +
            `&from_date=${from_date.split(" ").join("+")}` +
            `&to_date=${to_date.split(" ").join("+")}`
        )
    } else if (search_type == "availabilities_lastweek") {
        today = new Date()
        lastweek = new Date(today - (6 * 24 * 60 * 60 * 1000))
        from_date = lastweek.toISOString().slice(0, 10)
        to_date = today.toISOString().slice(0, 10)
        availabilitySearch(
            "/ggus_tool/availability?" +
            `&from_date=${from_date}` +
            `&to_date=${to_date}`
        )
    } else if (search_type == "availabilities") {
        from_date = new Date(document.forms[1].from_date.value)
        to_date = new Date(document.forms[1].to_date.value)
        if (from_date == "Invalid Date" || to_date == "Invalid Date")
            return alert("Invalid date input")
        from_date = from_date.toISOString().slice(0, 10)
        to_date = to_date.toISOString().slice(0, 10)
        availabilitySearch(
            "/ggus_tool/availability?" +
            `&from_date=${from_date}` +
            `&to_date=${to_date}`
        )
    }
}

function ticketSearch(url) {
    document.getElementById("loading_gif").style.display = "block"
    xhr = new XMLHttpRequest()
    xhr.open("GET", url)
    xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            json = JSON.parse(xhr.responseText)
            console.log(json)

            // Clear previous table if exists
            table = document.getElementById("mainTable")
            while (table.firstChild)
                table.removeChild(table.firstChild)

            if (json.tickets == "") {
                table.textContent = "No data."
                document.getElementById("loading_gif").style.display = "none"
                return
            }

            // Append headers as <th>
            headers = Object.keys(json.tickets.ticket[0]).filter(headerFilter)
            row = document.createElement("tr")
            for (header of headers) {
                if (header == "priority_color")
                    continue
                item = document.createElement("th")
                item.textContent = header[0].toUpperCase()
                item.textContent += header.split("_").join(" ").slice(1)
                row.appendChild(item)
            }
            table.appendChild(row)

            // Append each ticket
            for (ticket of json.tickets.ticket) {
                row = document.createElement("tr")
                for (header of headers) {
                    value = ticket[header][0]

                    // Apply colours to ticket IDs
                    if (header == "priority_color") {
                        console.log("color: ", value)
                        color = colormap[value]
                        row.firstChild.setAttribute("style", `background-color: ${color}`)
                        continue
                    }

                    // Filter time from dates
                    if (header == "date_of_creation" || header == "last_update") {
                        date = new Date(value)
                        value = date.toLocaleDateString("en-gb")
                    }

                    item = document.createElement("td")
                    item.textContent = value
                    row.appendChild(item)
                }
                table.appendChild(row)
            }
            document.getElementById("loading_gif").style.display = "none"
        } else {
            document.getElementById("mainTable").textContent = "Request error"
            document.getElementById("loading_gif").style.display = "none"
        }
    }
    xhr.send()
}

function availabilitySearch(url) {
    document.getElementById("loading_gif").style.display = "block"
    xhr = new XMLHttpRequest()
    xhr.open("GET", url)
    xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            json = pivotAvailabilities(JSON.parse(xhr.responseText))
            console.log(json)
            days = Object.keys(json).sort()
            headers = Object.keys(json[days[0]]).sort()

            // Clear previous table if exists
            table = document.getElementById("mainTable")
            while (table.firstChild)
                table.removeChild(table.firstChild)

            row = document.createElement("tr")
            item = document.createElement("th")
            item.textContent = "Day"
            row.appendChild(item)
            for (header of headers) {
                item = document.createElement("th")
                item.textContent = header
                row.appendChild(item)
            }
            item = document.createElement("th")
            item.textContent = "Comment"
            row.appendChild(item)
            table.appendChild(row)

            for (day of days) {
                row = document.createElement("tr")
                item = document.createElement("td")
                item.textContent = day
                row.appendChild(item)
                for (header of headers) {
                    item = document.createElement("td")
                    item.textContent = json[day][header]
                    row.appendChild(item)
                }
                row.appendChild(document.createElement("td"))
                table.appendChild(row)
            }

            document.getElementById("loading_gif").style.display = "none"
        } else {
            document.getElementById("mainTable").textContent = "Request error"
            document.getElementById("loading_gif").style.display = "none"
        }
    }
    xhr.send()
}

function pivotAvailabilities(json) {
    console.log(json)
    output = {}

    for (virt_org in json) {
        if (virt_org == "OPS")
            continue
        for (obj of json[virt_org].data[0].data) {
            date = obj.date.split("/").join("-")
            if (output[date] === undefined)
                output[date] = {}
            output[date][virt_org] = obj.OK * 100
        }
    }

    for (obj of json.OPS.entries[0].Entity) {
        output[obj.timestamp]["OPS"] = obj.availability
    }

    return output
}

function wikiConvert() {
    table = document.getElementById("mainTable")
    textarea = document.getElementById("mainTextarea")
    textarea.style.display = "block"
    textarea.value =  "{| border=1 align=center\n"
    textarea.value += '|- bgcolor="#7c8aaf"\n'
    for (header of table.children[0].children)
        textarea.value += `! ${header.textContent}\n`
    for (i = 1; i < table.childElementCount; i++) {
        textarea.value += "|-\n"
        for (item of table.children[i].children)
            textarea.value += `| ${item.textContent}\n`
    }
    textarea.value += "|}"
}

function getDate( element ) {
    try {
        return $.datepicker.parseDate("d M yy", element.value)
    }
    catch(error) {
        return null
    }
}

$(function() {
    from_date = document.forms[1].from_date
    to_date = document.forms[1].to_date

    var $from = $(from_date).datepicker(datePickerOptions)
    .on("change", function() {
        $to.datepicker("option", "minDate", getDate(this))
    })
    var $to = $(to_date).datepicker(datePickerOptions)
    .on("change", function() {
        $from.datepicker("option", "maxDate", getDate(this))
    })
})
