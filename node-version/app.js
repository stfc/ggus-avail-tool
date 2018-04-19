const fs            = require("fs")
const request       = require("request-promise")
const express       = require("express")
const path          = require("path")
const xml2js        = require("xml2js")
const bodyparser    = require("body-parser")

const config        = require("./config.json")

HOSTCERT = fs.readFileSync(config.hostcert)
HOSTKEY  = fs.readFileSync(config.hostkey)

const app = express()
const ggus_tool = express.Router()

ggus_tool.get("/", (req, res) => {
    res.redirect(req.baseUrl + "/index.html")
})

ggus_tool.get("/ggus", (req, res) => {
    console.log("GETTING ggustickets", req.url)
    request.get({
        url: "https://ggus.eu/?mode=ticket_search" +
             "&affectedsite=RAL-LCG2" +
             "&writeFormat=XML" +
             "&search_submit=GO%21" +
             "&orderticketsby=REQUEST_ID" +
             "&orderhow=desc" +
             req.url.slice(6),
        agentOptions: {
            cert: HOSTCERT,
            key: HOSTKEY
        }
    })
    .then(ggus_res => {
        xml2js.parseString(ggus_res, (err, result) => {
            if (err)
                res.sendStatus(500)
            else {
                res.send(result)
            }
        })
    })
})

function buildAvailabilityURL(site, profile, group) {
    url  = `http://wlcg-sam-${site}.cern.ch/`
    url += "dashboard/request.py/getstatsresultsmin?"
    url += `&profile_name=${profile}`
    url += `&group_name=${group}`
    url += "&granularity=daily"
    url += "&view=siteavl"
    // url += "&time_range=lastWeek"
    return url
}

availabilityURLs = {
    "atlas": buildAvailabilityURL("atlas", "ATLAS_CRITICAL", "RAL-LCG2"),
    "atlas-echo": buildAvailabilityURL("atlas", "ATLAS_CRITICAL", "RAL-LCG2-ECHO"),
    "cms": buildAvailabilityURL("cms", "CMS_CRITICAL", "T1_UK_RAL"),
    "lhcb": buildAvailabilityURL("lhcb", "LHCb_CRITICAL", "LCG.RAL.uk"),
    "alice": buildAvailabilityURL("alice", "ALICE_CRITICAL", "RAL")
}
numberofsites = 6
availabilityOPS = " http://argo.egi.eu/lavoisier/site_ar?" +
    "site=RAL-LCG2" +
    "&cr=1" +
    "&report=Critical" +
    "&granularity=DAILY" +
    "&accept=json"

ggus_tool.get("/availability", (req, res) => {
    from_date = new Date(req.query.from_date)
    to_date = new Date(req.query.to_date)
    if (from_date == "Invalid Date" || to_date == "Invalid Date")
        return res.sendStatus(500)

    start_time = from_date.toISOString().split(".")[0]+"Z"
    end_time = to_date.toISOString().split(".")[0]+"Z"
    // .split(".")[0]+"Z" removes milliseconds
    start_date = start_time.slice(0, 10)
    end_date = end_time.slice(0, 10)

    output = {}

    for (site in availabilityURLs) {
        url = availabilityURLs[site]
        url += `&start_time=${start_time}`
        url += `&end_time=${end_time}`
        console.log("GETTING availability", url)
        request.get(url)
        .then(response => {
            response = JSON.parse(response)
            // ECHO and atlas are the same profile name
            if (response.meta.group_name[0] == "RAL-LCG2-ECHO")
                response.meta.profile_name[0] = "ATLAS-ECHO"
            output[response.meta.profile_name[0].split("_")[0]] = response
            if (Object.keys(output).length == numberofsites) {
                res.send(output)
            }
        })
        .catch(err => {
            res.status(500).send(err)
            console.log("500 error", url)
        })
    }

    opsURL = availabilityOPS
    opsURL += `&start_date=${start_date}`
    opsURL += `&end_date=${end_date}`
    request.get(opsURL)
    .then(response => {
        response = JSON.parse(response)
        output["OPS"] = response
        if (Object.keys(output).length == numberofsites) {
            res.send(output)
        }
    })
    .catch(err => {
        res.status(500).send(err)
        console.log("500 error", opsURL)
    })
})

ggus_tool.get("/*", (req, res) => {
    console.log("REQUESTED", req.url)
    res.status(200).sendFile(
        path.join(__dirname, "public", req.url), {}, (err) => {
            if (err) {
                res.status(404).send("File not found")
                console.log("404'd", req.url)
            }
        }
    )
})

app.use("/ggus_tool", ggus_tool)
app.listen(3000, "127.0.0.1", function() {
    console.log("App running on port 3000.")
})
