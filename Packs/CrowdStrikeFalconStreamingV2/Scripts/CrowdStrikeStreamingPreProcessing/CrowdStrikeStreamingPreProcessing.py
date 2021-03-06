import demistomock as demisto  # noqa: F401
from CommonServerPython import *  # noqa: F401

res = True
for inc in demisto.incidents():
    host = ''
    if inc['labels']:
        for t in inc['labels']:
            if t['type'] == 'System':
                host = t['value']
    if len(host) > 0:
        sameIncidents = demisto.executeCommand("getIncidents",
                                               {"query": "labels.value:\"" + host + "\"  and labels.type:System"})
        if not isError(sameIncidents[0]):
            # if found sameIncidents found, add this incident data to war room
            sameIncidentsCount = sameIncidents[0]['Contents']['total']
            if sameIncidentsCount > 0:
                res = False
                otherIncidents = sameIncidents[0]['Contents']['data']
                entries = []
                entries.append({'Contents': "Duplicate incident from crowdstrike: " + inc['name']})
                entries.append({"Type": 1, "ContentsFormat": "json", "Contents": json.dumps(inc)})
                entries_str = json.dumps(entries)
                demisto.executeCommand("addEntries", {"id": otherIncidents[0]["id"], "entries": entries_str})

demisto.results(res)
