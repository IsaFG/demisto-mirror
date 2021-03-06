res = [];

var search_done = false;
var error = false;

var timeout = ('timeout' in args) ? parseInt(args.timeout) : 600;
var interval = ('interval' in args) ? parseInt(args.interval) : 10;

var search_args = {};
if ('query_expression' in args) {
    search_args.query_expression = args.query_expression;
}
if ('fields' in args) {
    search_args.fields = args.fields;
}
if ('range' in args) {
    search_args.range = args.range;
}

if ('headers' in args) {
    search_args.headers = args.headers;
}

//submit query, retrive  search_id
var query_res = executeCommand("qradar-searches", search_args);

if (isError(query_res[0])) {
    return query_res;
} else {
    search_id = dq(query_res[0], "Contents.search_id");
    search_args.search_id = search_id;

    //polling stage
    var sec = 0;
    while ((sec < timeout) && !error) {
        status_res = executeCommand("qradar-get-search", search_args);
        if (isError(status_res[0])) {
            return status_res;
        }

        var q_status = dq(status_res[0], "Contents.status");

        if (q_status && ['WAIT', 'EXECUTE', 'SORTING'].indexOf(q_status) !== -1) {
            // Not finished
        } else if (q_status && q_status == 'COMPLETED') {
            search_done = true;
        } else {
            error = true;
            return {"Type" : entryTypes.error, "ContentsFormat" : formats.text, "Contents" : 'An Error occurred during the search process. search status={0}.'.format(q_status)};
        }

        if (search_done) {
            break;
        }

        sec += interval;
        wait(interval);
    }

    if (sec >= timeout) {
        return {"Type" : entryTypes.error, "ContentsFormat" : formats.text, "Contents" : 'Timeout reached. waited for {0} seconds'.format(timeout)};
    }

    // get results
    if (search_done) {
        return executeCommand("qradar-get-search-results", search_args);
    } else {
        return {"Type" : entryTypes.error, "ContentsFormat" : formats.text, "Contents" : 'Unexpected error occurred'};
    }
}
