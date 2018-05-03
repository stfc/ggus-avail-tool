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

function buildAvailabilityURL(site, profile, group) {
    url  = `http://wlcg-sam-${site}.cern.ch/`
    url += "dashboard/request.py/getstatsresultsmin?"
    url += `&profile_name=${profile}`
    url += `&group_name=${group}`
    url += "&granularity=daily"
    url += "&view=siteavl"
    return url
}

availabilityURLs = {
    "Atlas": buildAvailabilityURL("atlas", "ATLAS_CRITICAL", "RAL-LCG2"),
    "Atlas-Echo": buildAvailabilityURL("atlas", "ATLAS_CRITICAL", "RAL-LCG2-ECHO"),
    "CMS": buildAvailabilityURL("cms", "CMS_CRITICAL", "T1_UK_RAL"),
    "LHCB": buildAvailabilityURL("lhcb", "LHCb_CRITICAL", "LCG.RAL.uk"),
    "Alice": buildAvailabilityURL("alice", "ALICE_CRITICAL", "RAL"),
    "OPS": " http://argo.egi.eu/lavoisier/site_ar?" +
        "site=RAL-LCG2" +
        "&cr=1" +
        "&report=Critical" +
        "&granularity=DAILY" +
        "&accept=json"
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
        ticketSearch("opened")
    }
    else if (search_type == "closed_lastweek") {
        ticketSearch("closed_lastweek")
    }
    else if (search_type == "closed") {
        from_date = document.forms[1].from_date.value
        to_date = document.forms[1].to_date.value
        if (new Date(from_date) == "Invalid Date" || new Date(to_date) == "Invalid Date")
            return alert("Invalid date input")
        timeframe = [from_date.split(" ").join("+"), to_date.split(" ").join("+")]
        ticketSearch("closed", timeframe)
    }
    else if (search_type == "availabilities_lastweek") {
        today = new Date().getTime()
        yesterday = new Date(today - (1000 * 60 * 60 * 24))
        lastweek = new Date(today - (1000 * 60 * 60 * 24 * 7))
        availabilitySearch(lastweek, yesterday)
    }
    else if (search_type == "availabilities") {
        input_from_date = new Date(document.forms[1].from_date.value).getTime()
        input_to_date = new Date(document.forms[1].to_date.value).getTime()
        // Both days are skewed by one
        from_date = new Date(input_from_date + (1000 * 60 * 60 * 24))
        to_date = new Date(input_to_date + (1000 * 60 * 60 * 24))
        if (from_date == "Invalid Date" || to_date == "Invalid Date")
            return alert("Invalid date input")
        availabilitySearch(from_date, to_date)
    }
}

function ticketSearch(type, timeframe) {
    if (type == "opened") {
        url_suffix = "&status=open" +
            "&date_type=creation+date" +
            "&tf_radio=1" +
            "&timeframe=any"
    } else if (type == "closed_lastweek") {
        url_suffix = "&status=terminal" +
            "&date_type=closing+date" +
            "&tf_radio=1" +
            "&timeframe=lastweek"
    } else if (type == "closed") {
        url_suffix = "&status=terminal" +
            "&date_type=closing+date" +
            "&tf_radio=2" +
            `&from_date=${timeframe[0]}` +
            `&to_date=${timeframe[1]}`
    }

    url_prefix = "https://ggus.eu/?mode=ticket_search" +
        "&affectedsite=RAL-LCG2" +
        "&writeFormat=XML" +
        "&search_submit=GO%21" +
        "&orderticketsby=REQUEST_ID" +
        "&orderhow=desc"

    url = url_prefix + url_suffix
    console.log(url)

    document.getElementById("loading_gif").style.display = "block"
    xhr = new XMLHttpRequest()
    xhr.open("GET", url)
    xhr.withCredentials = true
    xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            console.log(xhr.responseText)
            xmlParser = new DOMParser()
            xml = xmlParser.parseFromString(xhr.responseText, "text/xml")
            console.log(xml)

            // Clear previous table if exists
            table = document.getElementById("mainTable")
            while (table.firstChild)
                table.removeChild(table.firstChild)

            if (xml.childNodes[0].childNodes.length == 0) {
                table.textContent = "No data."
                document.getElementById("loading_gif").style.display = "none"
                return
            }

            // Append headers as <th>
            headers = Array.prototype.slice.call(xml.childNodes[0].childNodes[0].childNodes)
                .reduce((headers, header) => {
                    headers.push(header.nodeName)
                    return headers
                }, [])
                .filter(headerFilter)
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
            for (ticket of xml.childNodes[0].childNodes) {
                console.log(ticket)
                row = document.createElement("tr")
                for (header of headers) {
                    value = ticket.getElementsByTagName(header)[0].textContent

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

function appendAvailability(urls) {
    document.getElementById("loading_gif").style.display = "block"
    table = document.getElementById("mainTable")
    if (urls.length == 0) {
        for (row of table.childNodes) {
            if (row.childNodes[0].textContent == "Day") {
                item = document.createElement("th")
                item.textContent = "Comments"
            }
            else
                item = document.createElement("td")
            row.appendChild(item)
        }
        return document.getElementById("loading_gif").style.display = "none"
    }

    isOPS = urls[0][0] == "OPS"
    xhr = new XMLHttpRequest()
    xhr.open("GET", urls[0][1])
    xhr.onload = () => {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            json = JSON.parse(xhr.responseText)
            console.log(json)

            days = []
            if (isOPS)
                json.entries[0].Entity.map(day => days.push(day.timestamp))
            else
                json.data[0].data.map(day => days.push(day.date.split("/").join("-")))
            days = days.sort()
            // Create each row if not done yet
            if (table.childElementCount == 1) {
                for (day of days) {
                    row = document.createElement("tr")
                    item = document.createElement("td")
                    item.textContent = day
                    row.appendChild(item)
                    table.appendChild(row)
                }
            }

            title = document.createElement("th")
            title.textContent = urls[0][0]
            table.childNodes[0].appendChild(title)

            function dayMap(day) {
                dayID = day.timestamp
                if (!isOPS)
                    dayID = day.date.split("/").join("-")
                for (row of table.childNodes) {
                    if (row.childNodes[0].textContent == dayID) {
                        item = document.createElement("td")
                        item.textContent = day.availability
                        if (!isOPS)
                            item.textContent = String(day.OK * 100)
                        row.appendChild(item)
                        break
                    }
                }
            }

            if (isOPS)
                json.entries[0].Entity.map(dayMap)
            else
                json.data[0].data.map(dayMap)

            urls = urls.slice(1)
            appendAvailability(urls)

        } else {
            console.error(xhr)
            document.getElementById("mainTable").textContent = "Request error"
            document.getElementById("loading_gif").style.display = "none"
        }
    }
    xhr.send()
}

function availabilitySearch(from_date, to_date) {
    start_time = from_date.toISOString().split(".")[0]+"Z"
    end_time = to_date.toISOString().split(".")[0]+"Z"
    // .split(".")[0]+"Z" removes milliseconds
    start_date = start_time.slice(0, 10)
    end_date = end_time.slice(0, 10)

    urls = []
    for (vo in availabilityURLs) {
        if (vo == "OPS") {
            urls.push([
                "OPS",
                availabilityURLs["OPS"] + `&start_date=${start_date}` + `&end_date=${end_date}`
            ])
        } else {
            urls.push([
                vo,
                availabilityURLs[vo] + `&start_time=${start_time}` + `&end_time=${end_time}`
            ])
        }
    }

    // Clear previous table if exists
    table = document.getElementById("mainTable")
    while (table.firstChild)
        table.removeChild(table.firstChild)

    // Create first row / column
    row = document.createElement("tr")
    item = document.createElement("th")
    item.textContent = "Day"
    row.appendChild(item)
    table.appendChild(row)

    console.log(urls)
    appendAvailability(urls)
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
