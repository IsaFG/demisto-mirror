/**
 * GenericPollingScheduledTask
 *   This task is ment to be scheduled by the ScheduleGenericPolling automation
 *   Logic:
 *     This task schedules itself to run 'interval' minutes from the current run, and decrease the 'timeout' accordingly.
 *     This happens until the end condition is met: either the 'timeout' reaches 0, or all IDs are finished running.
 *     Once the end condition is met, this task will complete the manual task with the given playbookID and tag.
 *
 *     The 'dt' parameter, when applied to the context, should retrieve a list of ids which have not finished running.
 *     Example:
 *          dt = "Joe.Analysis(val.Status != 'finished').ID"
 *          Breakdown:
 *              Joe - integration name
 *              Analysis - the object that contains the ID and the status
 *              Status - can be 'submitted', 'running' or 'finished'
 *              ID - the key that contains the id for polling
 */

function listOfStrings(v) {
    if (!Array.isArray(v)) {
        v = [v];
    }
    for (var i = 0; i < v.length; i++) {
        v[i] = v[i].toString();
    }
    return v;
}

// https://stackoverflow.com/questions/16227197/compute-intersection-of-two-arrays-in-javascript#16227294
function intersect(a, b) {
    var t;
    if (b.length > a.length) t = b, b = a, a = t; // indexOf to loop over shorter
    return a.filter(function (e) {
        return b.indexOf(e) > -1;
    }).filter(function (e, i, c) { // extra step to remove duplicates
        return c.indexOf(e) === i;
    });
}

function finish(playbookId, tag, err) {
    var params = { 'id': tag };
    if (err === undefined) {
        params.input = 'YES';
    } else {
        params.input = 'NO'
    }
    if (playbookId) {
        params.parentPlaybookID = playbookId;
    }
    return executeCommand("taskComplete", params);
}

function setNextRun(ids, playbookId, pollingCommand, pollingCommandArgName, pendingIds, interval, timeout, tag, additionalArgNames, additionalArgValues) {
    var idsStr = ids.replace(/"/g, '\\"');
    var playbookIdStr = '';
    if (playbookId !== undefined) {
        playbookIdStr = ' playbookId="' + playbookId + '"';
    }
    var cmd = '!GenericPollingScheduledTask pollingCommand="' + pollingCommand + '" pollingCommandArgName="' + pollingCommandArgName + '"' + playbookIdStr;
    cmd += ' ids="' + idsStr + '" pendingIds="' + pendingIds.replace(/"/g,'\\"') + '" interval="' + interval + '" timeout="' + (parseInt(timeout) - parseInt(interval)) + '" tag="' + tag + '"';
    cmd += ' additionalPollingCommandArgNames="' + additionalArgNames + '" additionalPollingCommandArgValues="' + additionalArgValues + '"';
    return executeCommand("ScheduleCommand", {
        'command': cmd,
        'cron': '*/' + interval + ' * * * *',
        'times': 1
    });
}

try {
    if (args.timeout <= 0) {
        return finish(args.playbookId, args.tag);
    }

    // Get ids that have not finished yet
    var ids = argToList(args.ids);
    for (var i = 0; i < ids.length; i++) {
        ids[i] = ids[i].replace(/[\\]*"/g, '');
    }


    // Set the context of the scheduled task to the local playbook context
    var idsToPoll = ids;
    var pendingPath = args.pendingIds;
    if ('playbookId' in args) {
        playbookContext = 'subplaybook-' + args.playbookId;
        pendingPath = playbookContext + "." + args.pendingIds;
    }
    var pendings = dq(invContext, pendingPath);

    if (pendings === null) {
        return finish(args.playbookId, args.tag);
    }

    var idsStrArr = listOfStrings(ids);
    var pendingsStrArr = listOfStrings(pendings);
    idsToPoll = intersect(idsStrArr, pendingsStrArr);
    if (idsToPoll.length === 0) {
        return finish(args.playbookId, args.tag);
    }

    // Run the polling command for each id
    var pollingCommandArgs = {};
    var names = argToList(args.additionalPollingCommandArgNames);
    var values = argToList(args.additionalPollingCommandArgValues);

    for (var index = 0; index < names.length; index++)
        pollingCommandArgs[names[index]] = values[index];

    pollingCommandArgs[args.pollingCommandArgName] = idsToPoll.join(',');
    var res = executeCommand(args.pollingCommand, pollingCommandArgs);

    // Change the context output of the polling results to the local playbook context
    if ('playbookId' in args) {
        for (var i = 0; i < res.length; i++) {
            if ('EntryContext' in res[i]) {
                for (var k in res[i].EntryContext) {
                    res[i].EntryContext[playbookContext + "." + k] = res[i].EntryContext[k];
                    delete res[i].EntryContext[k];
                }
            }
        }
    }

    // Schedule the next iteration
    var scheduleTaskRes = setNextRun(args.ids, args.playbookId, args.pollingCommand, args.pollingCommandArgName, args.pendingIds, args.interval, args.timeout, args.tag, args.additionalPollingCommandArgNames, args.additionalPollingCommandArgValues);
    if (isError(scheduleTaskRes[0])) {
        res.push(scheduleTaskRes);
    }

    return res;
}
catch (err) {
    finish(args.playbookId, args.tag, err);
    throw err;
}
