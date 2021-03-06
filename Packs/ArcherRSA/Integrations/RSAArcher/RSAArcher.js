var server = params.server.replace(/\/+$/, "");

var commands = {
  createRecord:     'archer-create-record',
  updateRecord:     'archer-update-record',
  updateRecordREST: 'archer-update-record-rest',
  getRecord:        'archer-get-record',
  searchApps:       'archer-search-applications',
  searchRecords:    'archer-search-records',
  getAppFields:     'archer-get-application-fields',
  deleteRecord:     'archer-delete-record',
  valueListForField: 'archer-get-field',
  fetchIncidents: 'archer-fetch-incidents',
  getReports: 'archer-get-reports',
  executeStatisticSearchByReport: 'archer-execute-statistic-search-by-report',
  getSearchOptionsByGuid: 'archer-get-search-options-by-guid',
  searchRecordsByReport: 'archer-search-records-by-report',
  getMappingByLevel: 'archer-get-mapping-by-level',
  manualFetch: 'archer-manually-fetch-incident',
  getFile: 'archer-get-file',
  uploadFile: 'archer-upload-file',
  addToDetailedAnalysis: 'archer-add-to-detailed-analysis',
  getUserId: 'archer-get-user-id',
  getSubformId: 'archer-get-subform-id',
  getValueList: 'archer-get-valuelist'
};

var urlDictionary = {};
urlDictionary.login = '/ws/general.asmx';
urlDictionary.logout = '/ws/general.asmx';
urlDictionary.levelIdByModuleId = '/api/core/system/level/module/%applicationId%';
urlDictionary.fieldByLevelId = '/api/core/system/fielddefinition/level/%levelId%';
urlDictionary[commands.createRecord] = '/ws/record.asmx';
urlDictionary[commands.updateRecord] = '/ws/record.asmx';
urlDictionary[commands.getRecord] = '/ws/record.asmx';
urlDictionary[commands.searchApps] = '/api/core/system/application';
urlDictionary[commands.searchRecords] = '/ws/search.asmx';
urlDictionary[commands.deleteRecord] = '/ws/record.asmx';
urlDictionary[commands.valueListForField] = '/ws/field.asmx';
urlDictionary[commands.getReports] = '/ws/search.asmx';
urlDictionary[commands.executeStatisticSearchByReport] = '/ws/search.asmx';
urlDictionary[commands.getSearchOptionsByGuid] = '/ws/search.asmx';
urlDictionary[commands.searchRecordsByReport] = '/ws/search.asmx';
urlDictionary[commands.getFile] = '/ws/record.asmx';
urlDictionary[commands.uploadFile] = '/api/core/content/attachment';
urlDictionary[commands.getUserId] = '/ws/accesscontrol.asmx';

var methodDictionary = {};
methodDictionary.login = 'POST';
methodDictionary.logout = 'POST';
methodDictionary.levelIdByModuleId = 'POST';
methodDictionary.fieldByLevelId = 'POST';
methodDictionary[commands.createRecord] = 'POST';
methodDictionary[commands.updateRecord] = 'POST';
methodDictionary[commands.updateRecordREST] = 'PUT';
methodDictionary[commands.getRecord] = 'POST';
methodDictionary[commands.searchApps] = 'POST';
methodDictionary[commands.searchRecords] = 'POST';
methodDictionary[commands.deleteRecord] = 'POST';
methodDictionary[commands.valueListForField] = 'POST';
methodDictionary[commands.getReports] = 'POST';
methodDictionary[commands.executeStatisticSearchByReport] = 'POST';
methodDictionary[commands.getSearchOptionsByGuid] = 'POST';
methodDictionary[commands.searchRecordsByReport] = 'POST';
methodDictionary[commands.getFile] = 'POST';
methodDictionary[commands.uploadFile] = 'POST';
methodDictionary[commands.getUserId] = 'POST';
methodDictionary[commands.getSubformId] = 'POST';

var GLOBAL_MAPPING = {};
var dateRe = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/;

// Requests senders

function sendRestRequest(url, cmd, bodyContent, httpTunneling, queryParams) {
    var headers = {
        'Content-Type': ['application/json'],
        'Accept': ['application/json']
    };

    if(httpTunneling) {
        headers['X-Http-Method-Override'] = ['GET'];
    }

    var fullurl = server + url;

    if (queryParams) {
        fullurl += queryParams;
    }
    var body = JSON.stringify(bodyContent);
    var currentToken;

    var cache = getIntegrationContext();
    // if we don't have token
    if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
        // there is a lock in place
        var locked = true;
        var total = 0;
        while (Object.keys(cache).indexOf("lock") > -1 && (cache["lock"] === true || cache["lock"] === "true") && locked && cache["valid"]){
            logInfo("Waiting for lock to end");
            total += 2000;
            sleep(2000);
            cache = getIntegrationContext();
            if (cache["lock"] !== true || total > 60000){
                // breaking lock after 1 minute
                locked = false;
            }
        }
        // no lock
        if (!(Object.keys(cache).indexOf("lock") > -1) || cache["valid"] !== false){
            currentToken = cache["token"];
            logInfo("Taking token " + currentToken + " from cache")
        } else {
            currentToken = getAuthToken();
            var dic = {};
            dic["token"] = currentToken;
            dic["lock"] = true;
            var updatedCache = mergeOptions(cache, dic);
            setIntegrationContext(updatedCache);
            logInfo("Token wasn't found in cache, created token: " + currentToken + " and putting it in the cache")
        }
    } else {
        currentToken = getAuthToken();
        var dic = {};
        dic["token"] = currentToken;
        dic["lock"] = true;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
        logInfo("Token wasn't found in cache, created token: " + currentToken + " and putting it in the cache")
    }

    for(i = 0; i<15; i++){
        if (currentToken) {
            headers.Authorization = ['Archer session-id=' + currentToken];
        }

        var result = http(
            fullurl,
            {
                Method: methodDictionary[cmd],
                Headers: headers,
                Body: body ? body : ''
            },
            params.insecure,
            params.proxy
        );

        if (result.StatusCode < 200 || result.StatusCode >= 300) {
            logInfo('Bad status code from Archer: ' + result.StatusCode + ' with session token: ' + headers.Authorization + ' for request to path: ' + fullurl);
            logInfo('Result from Archer: ' + result.Body + ' request body was: ' + body);
            // check if we are locked and if there is a new token in place already
            cache = getIntegrationContext();
            var locked = false;
            var total = 0;

            while (Object.keys(cache).indexOf("lock") > -1 && (cache["lock"] === true) && locked){
                logInfo("Waiting for lock to end");
                sleep(2000);
                cache = getIntegrationContext();
                total += 2000;

                if (cache["lock"] !== true || total > 60000){
                    // breaking the lock after 1 minute
                    locked = false;
                }
            }
            if (Object.keys(cache).indexOf("valid") > -1 && cache["valid"] === true && cache["token"] !== currentToken){
                currentToken = cache["token"];
            } else {
                currentToken = getAuthToken();
            }

            var dic = {};
            dic["token"] = currentToken;
            dic["lock"] = true;
            var updatedCache = mergeOptions(cache, dic);
            setIntegrationContext(updatedCache);
            logInfo("Putting a newly token in cache which was generated after an error, token is: " + currentToken);

            if (i==14){
                var dic = {};
                dic["valid"] = false;
                dic["lock"] = false;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
                throw 'Request to RSA Archer ' + fullurl + ' failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';
            }
            continue;
        }
        logInfo('Successful request to RSA Archer ' + fullurl + ' with session token: ' + currentToken);
        var dic = {};
        dic["token"] = currentToken;
        dic["valid"] = true;
        dic["lock"] = false;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
        return JSON.parse(result.Body);
    }
}

function soapRequestSender(cmd, bodyContent, SOAPAction) {
    var headers = {'Content-Type': ['text/xml; charset=utf-8']};
    if (SOAPAction) {
        headers.SOAPAction = [SOAPAction];
    }
    var url =  server +  urlDictionary[cmd];
    var result = http(
        url,
        {
            Method: methodDictionary[cmd],
            Headers: headers,
            Body: bodyContent
        },
        params.insecure,
        params.proxy
    );
    return result;
}

function sendSoapRequest(cmd, bodyContent, SOAPAction) {
    var headers = {'Content-Type': ['text/xml; charset=utf-8']};
    if (SOAPAction) {
        headers.SOAPAction = [SOAPAction];
    }
    var url =  server +  urlDictionary[cmd];
    var result = http(
        url,
        {
            Method: methodDictionary[cmd],
            Headers: headers,
            Body: bodyContent
        },
        params.insecure,
        params.proxy
    );

    if (result.StatusCode < 200 || result.StatusCode >= 300) {
        throw 'Request to RSA Archer ' + url + ' failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';
    }

    return result.Body;
}

function getRecordSendSoapRequest(cmd, applicationId, contentId) {
    var currentToken;
    var cache = getIntegrationContext();
    // if we don't have token
    if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
        currentToken = cache["token"];
    } else {
        currentToken = getAuthToken();
        var dic = {};
        dic["token"] = currentToken;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
    }

    for(var i = 0; i<5; i++){
        var soap = getContentSoapRequest(currentToken, applicationId, contentId);
        var SOAPAction = 'http://archer-tech.com/webservices/GetRecordById';
        var result = soapRequestSender(cmd, soap, SOAPAction);
        if (result.StatusCode < 200 || result.StatusCode >= 300) {
            if (result.StatusCode === 500 || result.StatusCode === -1 || result.StatusCode === 401){ // unauthorized, try again
                currentToken = getAuthToken();
                var dic = {};
                dic["token"] = currentToken;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
                continue;
            }
            throw 'Request to RSA Archer failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';
        }
        return result.Body;
    }
}

function searchSendSoapRequest(
  cmd,
  appId,
  fields,
  maxResults,
  fieldIdToSearchOn,
  fieldNameToSearchOn,
  searchValue,
  sortByFieldId, isDescending, numericOperator, dateOperator, pageNumber, fetchFilter) {
    var currentToken;

    var cache = getIntegrationContext();
    // if we don't have token
    if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
        // there is a lock in place
        var locked = true;
        var total = 0;
        while (Object.keys(cache).indexOf("lock") > -1 && (cache["lock"] === true || cache["lock"] === "true") && locked && cache["valid"]){
            logInfo("Waiting for lock to end");
            total += 2000;
            sleep(2000);
            cache = getIntegrationContext();
            if (cache["lock"] !== true || total > 60000){
                // breaking lock after 1 minute
                locked = false;
            }
        }
        // no lock
        if (!(Object.keys(cache).indexOf("lock") > -1) || cache["valid"] !== false){
            currentToken = cache["token"];
            logInfo("Taking token " + currentToken + " from cache")
        } else {
            currentToken = getAuthToken();
            var dic = {};
            dic["token"] = currentToken;
            dic["lock"] = true;
            var updatedCache = mergeOptions(cache, dic);
            setIntegrationContext(updatedCache);
            logInfo("Token wasn't found in cache, created token: " + currentToken + " and putting it in the cache")
        }
    } else {
        currentToken = getAuthToken();
        var dic = {};
        dic["token"] = currentToken;
        dic["lock"] = true;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
        logInfo("Token wasn't found in cache, created token: " + currentToken + " and putting it in the cache")
    }

    for(var i = 0; i<15; i++){
        var soap = getContentsByAppIdRequest(
                currentToken,
                appId,
                fields,
                maxResults,
                fieldIdToSearchOn,
                fieldNameToSearchOn,
                searchValue,
                sortByFieldId,
                isDescending,
                numericOperator,
                dateOperator,
                pageNumber,
                fetchFilter);

        var SOAPAction = 'http://archer-tech.com/webservices/ExecuteSearch';
        var result = soapRequestSender(cmd, soap, SOAPAction);
        if (result.StatusCode < 200 || result.StatusCode >= 300) {
            if (result.StatusCode === 500 || result.StatusCode === 401 || result.StatusCode === -1){ // unauthorized, try again
                // check if we are locked and if there is a new token in place already
                cache = getIntegrationContext();
                var locked = false;
                var total = 0;

                while (Object.keys(cache).indexOf("lock") > -1 && (cache["lock"] === true) && locked){
                    logInfo("Waiting for lock to end");
                    sleep(2000);
                    cache = getIntegrationContext();
                    total += 2000;

                    if (cache["lock"] !== true || total > 60000){
                        // breaking the lock after 1 minute
                        locked = false;
                    }
                }
                if (Object.keys(cache).indexOf("valid") > -1 && cache["valid"] === true && cache["token"] !== currentToken){
                    currentToken = cache["token"];
                } else {
                    currentToken = getAuthToken();
                }

                var dic = {};
                dic["token"] = currentToken;
                dic["lock"] = true;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
                logInfo("Putting a newly token in cache which was generated after an error, token is: " + currentToken);

                if (i==14){
                    var dic = {};
                    dic["valid"] = false;
                    dic["lock"] = false;
                    var updatedCache = mergeOptions(cache, dic);
                    setIntegrationContext(updatedCache);
                    throw 'Request to RSA Archer ' + soap + ' failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';
                }
                continue;
            }
            throw 'Request to RSA Archer ' + soap + ' failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';

        }
        logInfo('Successful search records request to RSA Archer with session token: ' + currentToken);
        var dic = {};
        dic["token"] = currentToken;
        dic["valid"] = true;
        dic["lock"] = false;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);

        return result.Body;
    }
}

function downloadFileSendSoapRequest(cmd, fileId) {
    var currentToken;
    var cache = getIntegrationContext();
    // if we don't have token
    if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
        currentToken = cache["token"];
    } else {
        currentToken = getAuthToken();
        var dic = {};
        dic["token"] = currentToken;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
    }

    for(var i = 0; i<5; i++){
        var soap = getAttachmentFileSoapRequest(currentToken, fileId);
        var SOAPAction = 'http://archer-tech.com/webservices/GetAttachmentFile';
        var result = soapRequestSender(cmd, soap, SOAPAction);
        if (result.StatusCode < 200 || result.StatusCode >= 300) {
            if (result.StatusCode === 500 || result.StatusCode === -1 || result.StatusCode === 401){ // unauthorized, try again
                currentToken = getAuthToken();
                var dic = {};
                dic["token"] = currentToken;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
                continue;
            }
            throw 'Request to RSA Archer ' + url + ' failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';
        }
        return result.Body;
    }
}

function getContentIdsByIncIdsSendSoapRequest(appId, displayFields, incidentIds, levelId, displayId) {
    var currentToken = getAuthToken();
    var incidentIds;
    for(var i = 0; i<5; i++){
        var soap = getRecordIdsByIncIdsSoapRequest(currentToken, appId, displayFields, incidentIds, levelId, displayId);
        var SOAPAction = 'http://archer-tech.com/webservices/ExecuteSearch';
        var result = soapRequestSender('archer-search-records', soap, SOAPAction);
        if (result.StatusCode < 200 || result.StatusCode >= 300) {
            if (result.StatusCode === 500|| result.StatusCode === 401 || result.StatusCode === -1){ // unauthorized, try again
                currentToken = getAuthToken();
                continue;
            }
            throw 'Request to RSA Archer ' + soap + ' failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';
        }
        return result.Body;
    }
}

function getAuthToken() {
    var soap = createUserSessionFromInstanceSoapRequest(params.instanceName,
                                                        params.credentials.identifier,
                                                        params.credentials.password);
    var SOAPAction = 'http://archer-tech.com/webservices/CreateUserSessionFromInstance';
    var rawResponse;
    var result;
    var url;
    for (var i = 0; i<5; i++){
        result = soapRequestSender('login', soap, SOAPAction);
        if (result.StatusCode < 200 || result.StatusCode >= 300) {
            if (result.StatusCode === 500 || result.StatusCode === -1 || result.StatusCode === 401){ // unauthorized, try again
                continue;
            }
            throw 'Request to RSA Archer ' + url + ' failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';
        }
        rawResponse = result.Body;
        break;
    }
    try {
        var response = JSON.parse(x2j(rawResponse));
    } catch (err) {
        throw "Problem with login, please make sure that you have the right credentials. Original server response: " + rawResponse + " Error was: " + err
    }
    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        throw "Login failed. Request = " + soap + " Response = " + rawResponse;
    }

    var token = dq(response, 'Envelope.Body.CreateUserSessionFromInstanceResponse.CreateUserSessionFromInstanceResult');
    return token;
}

function destroyAuthToken(token) {
    var soap = terminateSessionSoapRequest(token);
    var SOAPAction = 'http://archer-tech.com/webservices/TerminateSession';
    for (var i = 0; i<5; i++){
        try {
            var result = soapRequestSender('logout', soap, SOAPAction);
            if (result.StatusCode < 200 || result.StatusCode >= 300) {
                if (result.StatusCode === 500 || result.StatusCode === -1){ // unauthorized, try again
                    continue;
                }
                throw 'destroyAuthToken Request to RSA Archer failed, request status code: ' + result.StatusCode + ' and Body: ' + result.Body + '.';
            }

            return;
        } catch(err) {
            if (err.indexOf('Invalid session token') > -1) {
                // it means the session token already expired so no need to be terminated
                return;
            }
            throw err;
        }
    }
}

/**
 * Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
 * @param obj1
 * @param obj2
 * @returns obj3 a new object based on obj1 and obj2
 */
function mergeOptions(obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

function sleep(ms) {
    var start = new Date().getTime();
    var expire = start + ms;
    while (new Date().getTime() < expire) {
        /*Do nothing*/
    }
    return;
}

// SOAP templates creators

function createUserSessionFromInstanceSoapRequest(instanceName, userName, password) {
    return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '  <soap:Body>' +
    '    <CreateUserSessionFromInstance xmlns="http://archer-tech.com/webservices/">' +
    '      <userName>' + userName + '</userName>' +
    '      <instanceName>' + instanceName + '</instanceName>' +
    '      <password>' + escapeXMLChars(password) + '</password>' +
    '    </CreateUserSessionFromInstance>' +
    '  </soap:Body>' +
    '</soap:Envelope>'
    );
}

function terminateSessionSoapRequest(token) {
    return(
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '    <soap:Body>' +
    '        <TerminateSession xmlns="http://archer-tech.com/webservices/">' +
    '        <sessionToken>' + token + '</sessionToken>' +
    '        </TerminateSession>' +
    '    </soap:Body>' +
    '</soap:Envelope>'
    );
}

function getContentsByAppIdRequest(token, appId, displayFields, maxResults,
    fieldIdToSearchOn, fieldNameToSearchOn, searchValue, sortByFieldId,
    isDescending, numericOperator, dateOperator, pageNumber, fetchFilter) {
    var readyMaxResults = (maxResults === undefined || maxResults === null) ? '100' : maxResults;
    return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '   <soap:Body>' +
    '       <ExecuteSearch xmlns="http://archer-tech.com/webservices/">' +
    '           <sessionToken>' + token + '</sessionToken>' +
    '           <searchOptions>' +
    '               <![CDATA[' +
    '                   <SearchReport>' +
    '                       <PageSize>' + readyMaxResults + '</PageSize>' +
    '                       <PageNumber>' + pageNumber + '</PageNumber>' +
    '                       <MaxRecordCount>' + (readyMaxResults || '1') + '</MaxRecordCount>' +
    '                       <ShowStatSummaries>false</ShowStatSummaries>' +
    '                       <DisplayFields>' + displayFields + '</DisplayFields>' +
    '                       <Criteria>' +
    '                           <ModuleCriteria>' +
    '                               <Module name="appname">' + appId + '</Module>' +
    '                           </ModuleCriteria>' +
                                (fieldIdToSearchOn ?
    '                           <Filter>' +
    '                               <Conditions>' +
                                        (dateOperator ?
    '                                   <DateComparisonFilterCondition>' +
    '                                       <Operator>' + dateOperator + '</Operator>' +
    '                                       <Field name="'+ escapeXMLChars(fieldNameToSearchOn) +'">' + fieldIdToSearchOn + '</Field>' +
    '                                       <Value>' + searchValue + '</Value>' +
    '                                       <TimeZoneId>UTC Standard Time</TimeZoneId>' +
    '                                       <IsTimeIncluded>TRUE</IsTimeIncluded>' +
    '                                   </DateComparisonFilterCondition>' : '') +
                                        ((!dateOperator && numericOperator) ?
    '                                   <NumericFilterCondition>' +
    '                                       <Operator>' + numericOperator + '</Operator>' +
    '                                       <Field name="'+ escapeXMLChars(fieldNameToSearchOn) +'">' + fieldIdToSearchOn + '</Field>' +
    '                                       <Value>' + searchValue + '</Value>' +
    '                                   </NumericFilterCondition>' : '') +
                                        ((!dateOperator && !numericOperator) ?
    '                                   <TextFilterCondition>' +
    '                                       <Operator>Contains</Operator>' +
    '                                       <Field name="'+ escapeXMLChars(fieldNameToSearchOn) +'">' + fieldIdToSearchOn + '</Field>' +
    '                                       <Value>' + searchValue + '</Value>' +
    '                                   </TextFilterCondition>' : '') +
                                        (fetchFilter ? fetchFilter : "") +
    '                               </Conditions>' +
    '                           </Filter>'
                                : '') +
                                (sortByFieldId ?
    '                           <SortFields>' +
    '                               <SortField>' +
    '                                   <Field>' + sortByFieldId + '</Field>' +
    '                                   <SortType>' + (isDescending ? 'Descending' : 'Ascending') + '</SortType>' +
    '                               </SortField>' +
    '                           </SortFields>'
                                : '') +
    '                       </Criteria>' +
    '                   </SearchReport>' +
    '               ]]>' +
    '           </searchOptions>' +
    '           <pageNumber>1</pageNumber>' +
    '       </ExecuteSearch>' +
    '   </soap:Body>' +
    '</soap:Envelope>'
    );
}

function createContentSoapRequest(token, appId, fields) {
    return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema- instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '   <soap:Body>' +
    '       <CreateRecord xmlns="http://archer-tech.com/webservices/">' +
    '           <sessionToken>' + token + '</sessionToken>' +
    '           <moduleId>' + appId + '</moduleId>' +
    '           <fieldValues> ' +
    '               <![CDATA[ ' +
    '                   <Record>' + fields + '</Record>' +
    '                ]]>' +
    '           </fieldValues>' +
    '       </CreateRecord>' +
    '   </soap:Body> ' +
    '</soap:Envelope>'
    );
}

function updateContentSoapRequest(token, appId, contentId, fields) {
    return (
    '<?xml version="1.0" encoding="utf-8"?> ' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchemainstance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '   <soap:Body>' +
    '       <UpdateRecord xmlns="http://archer-tech.com/webservices/">' +
    '           <sessionToken>' + token + '</sessionToken>' +
    '           <moduleId>' + appId + '</moduleId>' +
    '           <contentId>' + contentId +'</contentId>' +
    '           <fieldValues>' +
    '               <![CDATA[' +
    '                   <UpdateRecord>' + fields + '</UpdateRecord>' +
    '               ]]>' +
    '           </fieldValues>' +
    '       </UpdateRecord>' +
    '   </soap:Body>' +
    '</soap:Envelope>'
    );
}

function getContentSoapRequest(token, appId, contentId) {
    return (
    '<?xml version="1.0" encoding="utf-8"?> ' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchemainstance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '   <soap:Body>' +
    '       <GetRecordById xmlns="http://archer-tech.com/webservices/">' +
    '           <sessionToken>' + token + '</sessionToken>' +
    '           <moduleId>' + appId + '</moduleId>' +
    '           <contentId>' + contentId +'</contentId>' +
    '       </GetRecordById>' +
    '   </soap:Body>' +
    '</soap:Envelope>'
    );
}

function deleteContentSoapRequest(token, appId, contentId) {
    return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchemainstance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '   <soap:Body>' +
    '       <DeleteRecord xmlns="http://archer-tech.com/webservices/">' +
    '           <sessionToken>' + token + '</sessionToken>' +
    '           <moduleId>' + appId + '</moduleId>' +
    '           <contentId>' + contentId + '</contentId>' +
    '       </DeleteRecord>' +
    '   </soap:Body>' +
    '</soap:Envelope>'
    );
}

function getValueListForFieldSoapRequest(token, fieldID){
    return (
    '<?xml version="1.0" encoding="utf-8"?>'+
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchemainstance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
        '<soap:Body>'+
            '<GetValueListForField xmlns="http://archer-tech.com/webservices/">'+
                '<sessionToken>'+token+'</sessionToken>'+
                '<fieldId>'+fieldID+'</fieldId>'+
            '</GetValueListForField>'+
        '</soap:Body>'+
    '</soap:Envelope>'
    );
}

function getReportsSoapRequest(token){
    return (
    '<?xml version="1.0" encoding="utf-8"?>'+
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchemainstance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
        '<soap:Body>'+
            '<GetReports xmlns="http://archer-tech.com/webservices/">'+
                '<sessionToken>'+token+'</sessionToken>'+
            '</GetReports>'+
        '</soap:Body>'+
    '</soap:Envelope>'
    );
}

function executeStatisticSearchByReportSoapRequest(token, reportGuid, maxResults) {
    return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '  <soap:Body>' +
    '    <ExecuteStatisticSearchByReport xmlns="http://archer-tech.com/webservices/">' +
    '      <sessionToken>' + token + '</sessionToken>' +
    '      <reportIdOrGuid>' + reportGuid + '</reportIdOrGuid>' +
    '      <pageNumber>' + maxResults + '</pageNumber>' +
    '    </ExecuteStatisticSearchByReport>' +
    '  </soap:Body>' +
    '</soap:Envelope>'
    );
}

function getSearchOptionsByGuidSoapRequest(token, reportGuid) {
    return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '  <soap:Body>' +
    '    <GetSearchOptionsByGuid xmlns="http://archer-tech.com/webservices/">' +
    '      <sessionToken>' + token + '</sessionToken>' +
    '      <searchReportGuid>' + reportGuid + '</searchReportGuid>' +
    '    </GetSearchOptionsByGuid>' +
    '  </soap:Body>' +
    '</soap:Envelope>'
    );
}

function searchRecordsByReportSoapRequest(token, reportGuid, pageNumber) {
    return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '  <soap:Body>' +
    '    <SearchRecordsByReport xmlns="http://archer-tech.com/webservices/">' +
    '      <sessionToken>' + token + '</sessionToken>' +
    '      <reportIdOrGuid>' + reportGuid + '</reportIdOrGuid>' +
    '      <pageNumber>' + pageNumber + '</pageNumber>' +
    '    </SearchRecordsByReport>' +
    '  </soap:Body>' +
    '</soap:Envelope>'
    );
}

function getAttachmentFileSoapRequest(token, fileId) {
    return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '  <soap:Body>' +
    '    <GetAttachmentFile xmlns="http://archer-tech.com/webservices/">' +
    '      <sessionToken>' + token + '</sessionToken>' +
    '      <fileId>' + fileId + '</fileId>' +
    '    </GetAttachmentFile>' +
    '  </soap:Body>' +
    '</soap:Envelope>'
    );
}

function getRecordIdsByIncIdsSoapRequest(token, appId, displayFields, incidentIds, levelId, displayId) {
    return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '   <soap:Body>' +
    '       <ExecuteSearch xmlns="http://archer-tech.com/webservices/">' +
    '           <sessionToken>' + token + '</sessionToken>' +
    '           <searchOptions>' +
    '               <![CDATA[' +
    '                   <SearchReport>' +
    '                       <PageSize> 100 </PageSize>' +
    '                       <DisplayFields>'+
    '                           <DisplayField name="Incident Id">'+displayId+'</DisplayField> '+
    '                       </DisplayFields>' +
    '                       <Criteria>' +
    '                           <Keywords>' + incidentIds + '</Keywords>' +
    '                           <ModuleCriteria>' +
    '                               <Module name="appname">' + appId + '</Module>' +
    '                               <IsKeywordModule>true</IsKeywordModule>' +
    '                               <LevelIds> ' +
    '                                   <LevelId>' + levelId + '</LevelId>' +
    '                               </LevelIds>' +
    '                           </ModuleCriteria>' +
    '                       </Criteria>' +
    '                   </SearchReport>' +
    '               ]]>' +
    '           </searchOptions>' +
    '           <pageNumber>1</pageNumber>' +
    '       </ExecuteSearch>' +
    '   </soap:Body>' +
    '</soap:Envelope>'
    );
}

function getContentSubFormSoapRequest(token, appId, fieldId, fieldValues) {
    return (
    '<?xml version="1.0" encoding="utf-8"?> ' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchemainstance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '   <soap:Body>' +
    '       <CreateSubformRecord xmlns="http://archer-tech.com/webservices/">' +
    '           <sessionToken>' + token + '</sessionToken>' +
    '           <subformModuleId>' + appId + '</subformModuleId>' +
    '           <subformFieldId>' + fieldId +'</subformFieldId>' +
    '           <fieldValues>' +
    '               <![CDATA[' +
    '                   <CreateSubformRecord>' + fieldValues + '</CreateSubformRecord>' +
    '               ]]>' +
    '           </fieldValues>' +
    '       </CreateSubformRecord>' +
    '   </soap:Body>' +
    '</soap:Envelope>'
    );
}

function getUserIdSoapRequest(token, userName, userDomain) {
    return (
    '<?xml version="1.0" encoding="utf-8"?> ' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchemainstance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '   <soap:Body>' +
    '       <LookupDomainUserId xmlns="http://archer-tech.com/webservices/">' +
    '           <sessionToken>' + token + '</sessionToken>' +
    '           <username>' + userName + '</username>' +
    '           <usersDomain>' + userDomain +'</usersDomain>' +
    '       </LookupDomainUserId>' +
    '   </soap:Body>' +
    '</soap:Envelope>'
    );
}
// helper functions

function extractObjectFromXML(xml, path) {
    var searchRes = dq(xml, path);
    if (searchRes === "" || searchRes === null){
        return [];
    }
    if (searchRes.indexOf("<?xml") > -1) {
        var index = searchRes.indexOf(">");
        if (index !== -1) {
            searchRes = searchRes.substr(index + 1);
        }
    }
    return JSON.parse(x2j(searchRes));
}

function verifyOrMakeArray(arr){
    return Array.isArray(arr)? arr : [arr];
}

function createInnerRecordsHumanReadable(tables){
    var markdown = "";
    tables.forEach(function (table){
        markdown += tableToMarkdown(table[0], table[2], table[1]);
    });
    return markdown;
}

function reLogin(token){
    destroyAuthToken(token);
    return getAuthToken();
}

function getValueListJustForField(dataArgs) {
    // used to get a list of values corresponding to a specific field id
    var result = getValueListResult(commands.valueListForField, dataArgs);

    result = JSON.parse(x2j(result));
    results = {}
    results['valueList'] = result
    return results
}

function getValueListResult(command, dataArgs){
    // used to get a list of values corresponding to a specific field id
    var SOAPAction = 'http://archer-tech.com/webservices/GetValueListForField';
    var fieldID = dataArgs.fieldID;

    var token;
    var response;
    for (var i=0; i<15; i++){
        var cache = getIntegrationContext();
        // if we don't have token
        if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
            token = cache["token"];
        } else {
            token = getAuthToken();
            var dic = {};
            dic["token"] = token;
            var updatedCache = mergeOptions(cache, dic);
            setIntegrationContext(updatedCache);
        }
        var soap = getValueListForFieldSoapRequest(token, fieldID);
        try {
            response = JSON.parse(x2j(sendSoapRequest(command, soap, SOAPAction)));
            break;
        } catch (err) {
            if (i==14){
                throw "Archer didn't create a new record. We received the following response " + JSON.stringify(response);
            }
            token = getAuthToken();
            var dic = {};
            dic["token"] = token;
            var updatedCache = mergeOptions(cache, dic);
            setIntegrationContext(updatedCache);
        }
    }
    return dq(response, 'Envelope.Body.GetValueListForFieldResponse.GetValueListForFieldResult');
}

function getValueListForField(command, dataArgs){
    var result = getValueListResult(command, dataArgs);
    result = dq(JSON.parse(x2j(result)), 'SelectDef.SelectDefValues.SelectDefValue(true)={Name: val.Name, Id : val.Id}');

    if (typeof result === 'object' && result.constructor === Array)
    {

    }
    else
    {
        result = [result];
    }
    var ret = {};
    for (var key in result){
        ret[result[key]['Name']] = result[key]['Id'];
    }
    return ret;
}

function inputToXML(fieldsToValue, mapping){
    var fields = '';
    for (var key in fieldsToValue) {
        if (mapping[key] !== undefined) {
            switch(mapping[key].Type){
                case 1:
                case 2:
                case 3:
                case 11:
                    if (Array.isArray(fieldsToValue[key])){
                        fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key][0] +'">';
                        for(var i=1; i<fieldsToValue[key].length; i++){
                            fields+= '<MultiValue value="'+fieldsToValue[key][i]+'" />';
                        }
                        fields+= '</Field>';
                    } else{
                        fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key] + '" />';
                    }
                    break;
                case 19:
                    fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key] + '" />';
                    break;
                case 9:
                    if (Array.isArray(fieldsToValue[key])){
                        fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key][0] +'">';
                        for(var i=1; i<fieldsToValue[key].length; i++){
                            fields+= '<MultiValue value="'+fieldsToValue[key][i]+'" />';
                        }
                        fields+= '</Field>';
                    } else{
                        fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key] + '" />';
                    }
                    break;
                case 18:
                    fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key][0] +'">';
                    for(var i=1; i<fieldsToValue[key].length; i++){
                        fields+= '<MultiValue value="'+fieldsToValue[key][i]+'" />';
                    }
                    fields+= '</Field>';
                    break;
                case 4:
                    //fieldsToValue[key] is of the form [value1, value2,...]
                    var listValueIdtoName = getValueListForField(commands.valueListForField, {fieldID : mapping[key].Id});
                    if (Array.isArray(fieldsToValue[key])){
                        var fieldValue = listValueIdtoName[fieldsToValue[key][0]] || fieldsToValue[key][0];
                        fields += '<Field id="' + mapping[key].Id +'" value="' + fieldValue +'">';
                        for(var i=1; i<fieldsToValue[key].length; i++){
                            fields+= '<MultiValue value="'+listValueIdtoName[fieldsToValue[key][i]]+'" />';
                        }
                        fields+= '</Field>';
                    } else{
                        if (isNaN(fieldsToValue[key])){
                            fields += '<Field id="' + mapping[key].Id +'" value="' + listValueIdtoName[fieldsToValue[key]] + '" />';
                        } else{
                            fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key] + '" />';
                        }
                    }
                    break;

                case 7:
                    //fieldsToValue[key] is of the form [{value: ___ , link: ___}, {value: ___ , link: ___}, ...]
                    fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key][0].value + '" link="'+fieldsToValue[key][0].link+'">';
                    for(var i=1; i<fieldsToValue[key].length; i++){
                        fields+= '<MultiValue value="'+fieldsToValue[key][i].value+'" link="'+fieldsToValue[key][i].link+'" />';
                    }
                    fields+= '</Field>';
                    break;
                case 8:
                    if(fieldsToValue[key] && fieldsToValue[key] !== undefined){
                        fields += '<Field id="' + mapping[key].Id + '">';
                        fields += '<Users>';
                        fields += '<User id="' + fieldsToValue[key] + '"></User>';
                        fields += '</Users>';
                        fields += '</Field>';
                        break;
                    }

                case 15:
                    //fieldsToValue[key] is of the form {groups: [group1, group2,...], users : [user1, user2,...]}
                    fields+= '<Field id="' + mapping[key].Id + '" >';
                    groups = fieldsToValue[key].groups;
                    users = fieldsToValue[key].users;
                    if(groups && Array.isArray(groups) && groups.length > 0){
                        fields += '<Groups>';
                        for(var i=0; i<groups.length; i++){
                            fields += '<Group id="' + groups[i] + '" />';
                        }
                        fields += '</Groups>'
                    }
                    if(users && Array.isArray(users) && users.length > 0){
                        fields += '<Users>';
                        for(var i=0; i<users.length; i++){
                            fields += '<User id="' + users[i] + '" />';
                        }
                        fields += '</Users>'
                    }
                    fields+='</Field>';
                    break;
                case 23:
                    if (Array.isArray(fieldsToValue[key])){
                        fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key][0] +'">';
                        for(var i=1; i<fieldsToValue[key].length; i++){
                            fields+= '<MultiValue value="'+fieldsToValue[key][i]+'" />';
                        }
                        fields+= '</Field>';
                    } else{
                        fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key] + '" />';
                    }
                    break;
                case 24: // subform
                    // get subform id
                    if (Array.isArray(fieldsToValue[key])){
                        fields += '<Field id="' + mapping[key].Id +'" value="' + fieldsToValue[key][0] +'">';
                        for(var i=1; i<fieldsToValue[key].length; i++){
                            fields+= '<MultiValue value="'+fieldsToValue[key][i]+'" />';
                        }
                        fields+= '</Field>';
                    } else{
                        var idToCheck = mapping[key].Id;
                        var secFields = '<Field id="29906" value="' + fieldsToValue[key]+'" />';
                        var subFormId = getSubformId(idToCheck, 411, secFields);
                        fields += '<Field id="' + idToCheck +'" value="' + subFormId + '" />';
                    }
                    break;
                //case 14, 16 : not supported yet
            }
        }
    }
    return fields;
}

function createFieldsContentsObject(fieldsToValue, mapping){
    // This function prepares the payload for the REST API, specifically it creates an Object for each field in fieldsToValue, with its proper mapping
    // Each field has an Archer type. For example, type 1 correlates for Text fields
    // Example for fieldsToValue: {"Title":"Demisto","Date/Time Occurred":"3/23/2018 7:00 AM","Date/Time Identified":"3/23/2018 7:00 AM","Date/Time Reported":"3/23/2018 7:00 AM","Incident Summary":"test"}
    // Example for mapping: "Title":{"Type":1,"Id":16132,"levelId":232},"Incident ID (DFM)":{"Type":6,"Id":16133,"levelId":232},
    //                          "Target Asset Type":{"Type":4,"Id":16134,"levelId":232},"Date/Time Escalated":{"Type":3,"Id":16135,"levelId":232}...

    var fieldsContent = {};
    for (var fieldName in fieldsToValue) {
        if (mapping[fieldName] !== undefined) {
            var fieldValue = fieldsToValue[fieldName];
            var fieldNameMapping = mapping[fieldName];
            switch(fieldNameMapping.Type){
                case 1:
                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 1,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': fieldValue
                     };
                     break;

                case 2:
                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 2,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': fieldValue
                    };
                    break;

                case 3:
                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 3,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': fieldValue
                    };
                    break;

                case 4:
                    //fieldValue is of the form [value1, value2,...]
                    var listValueIdtoName = getValueListForField(commands.valueListForField, {fieldID : fieldNameMapping.Id});
                    var valueList = [];
                    if (listValueIdtoName !== {}){
                        if (Array.isArray(fieldValue)){
                            for(var i=0; i<fieldValue.length; i++){
                                if (listValueIdtoName[fieldValue[i]] !== undefined){
                                     valueList.push(listValueIdtoName[fieldValue[i]]);
                                }
                            }
                            if (valueList.length === 0){
                                valueList = fieldValue;
                            }
                        } else if (listValueIdtoName[fieldValue] !== undefined) {
                            valueList.push(listValueIdtoName[fieldValue]);
                        }
                    }
                    if (valueList.length === 0) {
                        valueList.push(fieldValue);
                    }


                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 4,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': {
                            'ValuesListIds': valueList,
                            'OtherText': null
                        }
                    };
                    break;

                case 7:
                    //fieldValue is of the form [{value: ___ , link: ___}, {value: ___ , link: ___}, ...]
                    var valueList = [];

                    valueList.push({
                        'Name': fieldValue[0].value,
                        'URL': fieldValue[0].link
                    })
                    for(var i=1; i<fieldValue.length; i++){
                        valueList.push({
                            'Name': fieldValue[i].value,
                            'URL': fieldValue[i].link
                        })
                    }
                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 7,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': valueList
                    };
                    break;

                case 8:
                //fieldValue is of the form {groups: [group1, group2,...], users : [user1, user2,...]}
                    if(fieldValue && fieldValue !== undefined){
                        var valueObject = {};
                        var added = false;
                        var groups = fieldValue.groups;
                        var users = fieldValue.users;
                        if(groups && Array.isArray(groups) && groups.length > 0){
                            var groupValueList = [];
                            for(var i=0; i<groups.length; i++){
                                groupValueList.push({
                                    "ID": parseInt(groups[i])
                                });
                            }
                            valueObject['GroupList'] = groupValueList;
                            added = true;
                        }
                        if(users && Array.isArray(users) && users.length > 0){
                            var usersValueList = [];
                            for(var i=0; i<users.length; i++){
                                usersValueList.push({
                                    "ID": parseInt(users[i])
                                });
                            }
                            valueObject['UserList'] = usersValueList;
                            added = true;
                        }
                        if (!added){
                            valueObject['UserList'] = [{
                                    "ID": fieldValue
                                }];
                        }
                        fieldsContent[fieldNameMapping.Id.toString()] = {
                            'Type': 8,
                            'FieldId': parseInt(fieldNameMapping.Id),
                            'Value': valueObject
                        };
                    }
                    break;

                case 9:
                    if(fieldValue && fieldValue !== undefined){
                        contentIdsList = [];
                        fieldValue = verifyOrMakeArray(fieldValue);
                        for(var i=0; i<fieldValue.length; i++){
                            contentIdsList.push({
                                "ContentID": parseInt(fieldValue[i])
                            })
                        }

                        fieldsContent[fieldNameMapping.Id.toString()] = {
                            'Type': 9,
                            'FieldId': parseInt(fieldNameMapping.Id),
                            'Value': contentIdsList
                        };
                    }
                    break;

                case 11:
                    valueList = []
                    if (Array.isArray(fieldValue)){
                        for(var i=0; i<fieldValue.length; i++){
                            valueList.push(fieldValue[i])
                        }
                    } else {
                        valueList.push(fieldValue)
                    }

                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 11,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': valueList
                    }
                    break;

                case 12:
                    valueList = [];
                    if (Array.isArray(fieldValue)){
                        for(var i=0; i<fieldValue.length; i++){
                            valueList.push(fieldValue[i])
                        }
                    } else {
                        valueList.push(fieldValue)
                    }

                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 12,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': valueList
                    }
                    break;

                case 19:
                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 19,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'IpAddressBytes': fieldValue
                     }
                    break;

                case 18:
                    valueList = [];
                    if (Array.isArray(fieldValue)){
                        for(var i=0; i<fieldValue.length; i++){
                            valueList.push(fieldValue[i]);
                        }
                    } else {
                        valueList.push(fieldValue);
                    }

                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 18,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': {'ValuesListIds': valueList, 'OtherText': null}
                    }

                    break;

                case 23:
                    valueList = [];
                    if (Array.isArray(fieldValue)){
                        for(var i=0; i<fieldValue.length; i++){
                            valueList.push(fieldValue[i])
                        }
                    } else {
                        valueList.push(fieldValue)
                    }

                    fieldsContent[fieldNameMapping.Id.toString()] = {
                        'Type': 23,
                        'FieldId': parseInt(fieldNameMapping.Id),
                        'Value': valueList
                    }

                    break;
                case 24: // subform - we need to create a sub record of another module id and then add its id to our record
                    // get subform id
                    valueList = [];
                    if (Array.isArray(fieldValue)){
                        for(var i=0; i<fieldValue.length; i++){
                            valueList.push(fieldValue[i])
                        }
                        fieldsContent[fieldNameMapping.Id.toString()] = {
                            'Type': 24,
                            'FieldId': parseInt(fieldNameMapping.Id),
                            'Value': valueList
                        }
                    } else {
                        var idToCheck = fieldNameMapping.Id;
                        var secFields = '<Field id="29906" value="' + fieldValue +'" />';
                        var subFormId = getSubformId(idToCheck, 411, secFields, fieldValue);
                        fieldsContent[fieldNameMapping.Id.toString()] = {
                            'Type': 24,
                            'FieldId': parseInt(idToCheck),
                            'Value': [subFormId]
                        }
                    }
                    break;
            }
        }
    }
    // example for fieldsContent: {"16132":{"Type":1,"FieldId":16132,"Value":"Demisto"},"16108":{"Type":1,"FieldId":16108,"Value":"test"}}
    return fieldsContent;
}

function getSearchRecords(parsedJSON, getInnerRecords, fullData) {
    /* getSearchRecords is used in searchRecords and creates an Object with each of the search results full records(with all
       of their inner fields) including their full inner records(with all of their inner fields). Note that it does it only
       for the first level of the inner records, they would have only a summary of their inner records but not the full record objects. */
    var records = dq(parsedJSON, 'Records.Record');
    if (!records) {
        return [];
    }
    var outputs =[];
    var seenRecords = {};
    records = verifyOrMakeArray(records);
    records.forEach(function (record) {
        // iterating over all of the records
        var contentId = record['-contentId'];
        var moduleId = record['-moduleId'];
        var toContext = {
            Id: contentId,
            ModuleId: moduleId,
            Fields: {}
        };
        // used later on to check if we need to bring more mappings
        var seenModuleIds = {};
        seenModuleIds[moduleId] = moduleId;
        // Getting base record
        if (fullData){
           var recordObject = getRecord(commands.getRecord, contentId, moduleId, false)[0].keyValsForFetch;
            toContext.Fields.Record = recordObject;
            if (getInnerRecords){
                // iterating over the base records inner records and getting their entire object
                var innerRecords = verifyOrMakeArray(recordObject.innerRecords); // contains all possible inner records
                innerRecords.forEach(function (innerRecord){
                    if (innerRecord){
                        if (innerRecord.levelId === "33"){ //buggy record type in Archer
                            return;
                        }
                        var innerRecordContentId = innerRecord.contentId;
                        if (seenRecords[innerRecordContentId]){
                            innerRecord.Record = seenRecords[innerRecordContentId];
                        } else {
                            var innerRecordModuleId = innerRecord.ModuleId || args.applicationId;
                            if(innerRecordModuleId && !(innerRecordModuleId in seenModuleIds)){
                                // we have an inner record from another module, so we bring the field mappings of the new module
                                extendAppIdMapping(innerRecordModuleId);
                                seenModuleIds[innerRecordModuleId] = innerRecordModuleId;
                            }
                            var recordRes = getRecord(commands.getRecord, innerRecordContentId, innerRecordModuleId, false);
                            var innerRecordRes = recordRes.length > 0 ? recordRes[0].keyValsForFetch : innerRecord;
                            innerRecord.Record = innerRecordRes;
                            seenRecords[innerRecordContentId] = innerRecordRes;
                        }
                    }
                });
            }
        }


        var fields = verifyOrMakeArray(record.Field);
        fields.forEach(function (field) {
            if (field['#text'] != null) {
                toContext.Fields[GLOBAL_MAPPING[field['-id']].Name] = field['#text'];
            } else if (field.ListValues != null && field.ListValues.ListValue['#text'] !== null) {
                toContext.Fields[GLOBAL_MAPPING[field['-id']].Name] = field.ListValues.ListValue['#text'];
            } else {
                toContext.Fields[GLOBAL_MAPPING[field['-id']].Name] = field['#text'];
            }
        });
        outputs.push(toContext);
    });
    return outputs;
}

function getOccurredTime(recordTimeStr, tz) {
    var occurred = new Date();
    if (recordTimeStr) {
        var tzHour = tz / 60;
        if (tzHour < 0) {
            tzHour *= -1;
        }
        var tzMinute = tz % 60;
        var tzPrefix = tz < 0 ? '-' : '+';
        var tzHourstr = tzHour + '';
        if (tzHourstr.length < 2) {
            tzHourstr = '0' + tzHourstr;
        }
        var tzMinutestr = tzMinute +'';
        if (tzMinutestr.length < 2) {
            tzMinutestr = '0' + tzMinutestr;
        }

        // convert 7/18/2017 8:17:49 AM to 2017-07-18T20:17:49-0800
        var dateStr = recordTimeStr.split(' ')[0];
        var monthStr;
        var dayStr;
        if (params.useEuropeanTime){
            // convert 05/03/2019 09:16:43 to 2019-03-05T09:16:43-0800
            dayStr = dateStr.split('/')[0];
            monthStr = dateStr.split('/')[1];
        } else {
            // convert 7/18/2017 8:17:49 to 2017-07-18T20:17:49-0800
            monthStr = dateStr.split('/')[0];
            dayStr = dateStr.split('/')[1];
        }

        var yearStr = dateStr.split('/')[2];

        var timeStr = recordTimeStr.split(' ')[1];
        var hourInt;
        var hourStr;
        if (params.useEuropeanTime){
            // convert 05/03/2019 09:16:43 to 2019-03-05T09:16:43-0800
            hourInt = Number(timeStr.split(':')[0]);
            hourStr = hourInt + '';
            if (Number(hourInt) < 10 && hourStr.length === 1) {
                hourStr = "0" + hourStr;
            }
        } else {
            // convert 7/18/2017 8:17:49 to 2017-07-18T20:17:49-0800
            var extStr = recordTimeStr.split(' ')[2];
            hourInt = Number(timeStr.split(':')[0]);
            if (extStr == "PM" && hourInt < 12) {
                hourInt = hourInt + 12;
            }

            if (extStr == "AM" && hourInt == 12) {
                hourInt = hourInt - 12;
            }

            hourStr = hourInt + '';
            if (Number(hourInt) < 10 && hourStr.length === 1) {
                hourStr = "0" + hourStr;
            }
        }

        var minStr = timeStr.split(':')[1];
        var secStr = timeStr.split(':')[2];

        if (Number(minStr) < 10 && minStr.length === 1) {
            minStr = "0" + minStr;
        }

        if (Number(dayStr) < 10 && dayStr.length === 1) {
            dayStr = "0" + dayStr;
        }

        if (Number(monthStr) < 10 && monthStr.length === 1) {
            monthStr = "0" + monthStr;
        }

        recordTimeStr = yearStr + '-' +  monthStr + '-' + dayStr + 'T' + hourStr + ':' + minStr + ':' + secStr;
        occurred = new Date(Date.parse(recordTimeStr + tzPrefix + tzHourstr + tzMinutestr));
    }

    return occurred;
}

function toDateArcherString(date) {
    var day = Number(date.getDate());
    var month = Number(date.getMonth()) + 1;
    var year = date.getFullYear();
    var hour = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    var ext = 'AM';
    var finalHour = hour;

    if (hour > 12) {
        ext = 'PM';
        finalHour = (hour - 12);
        if (finalHour == 12) {
            ext = 'AM';
        }
    } else if (hour < 12) {
        finalHour = hour;
        ext = 'AM';
    } else if (hour == 12) {
        ext = 'PM';
    }

    if (minutes < 10) {
        minutes = '0' + minutes;
    }

    if (seconds < 10) {
        seconds = '0' + seconds;
    }

    // format such: 7/22/2017 3:58 PM (American) or 22/7/2017 3:58 PM (European)
    if (params.useEuropeanTime){
        return day + '/' + month + '/' + year + ' ' + finalHour + ':' + minutes + ':' + seconds + ' ' + ext;
    }
    return month + '/' + day + '/' + year + ' ' + finalHour + ':' + minutes + ':' + seconds + ' ' + ext;
}

// mappings functions

function createMappingNameToFieldId(levels) {
    var nameToFieldIdMapping = {};
    if (!levels) {
        throw 'Mapping levels to Fields failed';
    }
    levels = verifyOrMakeArray(levels);

    levels.forEach(function (lvl) {
        var url = replaceInTemplatesAndRemove(urlDictionary.fieldByLevelId, {
            levelId: lvl
        });
        var fieldsLevelInfo = sendRestRequest(url, '', true);

        if (!Array.isArray(fieldsLevelInfo)) {
            fieldsLevelInfo = [fieldsLevelInfo];
        }

        fieldsLevelInfo.forEach(function (field) {
            if (field.RequestedObject.Type !== 25) {
                nameToFieldIdMapping[field.RequestedObject.Name] = {
                    Type: field.RequestedObject.Type,
                    Id: field.RequestedObject.Id,
                    levelId: lvl
                };
            }
        });
    });

    return nameToFieldIdMapping;
}

function extendMappingFieldIdToName(levels){
    var newMapping = createMappingFieldIdToName(levels);
    for (var attrname in newMapping) {
        GLOBAL_MAPPING[attrname] = newMapping[attrname];
    }
}

function getLevelsByApplicationId(applicationId) {
    var url = replaceInTemplatesAndRemove(urlDictionary.levelIdByModuleId, {
        applicationId: applicationId
    });
    var lvlResponse = sendRestRequest(url, 'levelIdByModuleId', '', true);
    return dq(lvlResponse, 'RequestedObject.Id');
}

function extendAppIdMapping(applicationId){
    // creates mapping of field ids to names by application and level ids
    var levels = getLevelsByApplicationId(applicationId);
    extendMappingFieldIdToName(levels);
}

// the following group of functions is used almost exclusively for the getRecord function

function getRecordContentMapping(fields, applicationId, contentId, saveFiles) {
    /* we have records who are linked to the record we are working on.
       innerRecordsTable will have the data related to the linked records
       recordVals will have the data related to the work record, and brief summary of the linked records
       attachedFiles would be an array with the data needed to download the record's attached files */

    var recordVals = [];
    var innerRecordsArray = [];
    if (fields) {
        fields.forEach(function (field) {
            var groupValue;
            if (field.Groups) { // handling the nested Groups field
                groupValue = getGroupsString(field.Groups);
            }
            // used later on to check if we need to bring more mappings
            var seenModuleIds = {};
            var seenLevelIds = {};
            seenModuleIds[applicationId] = applicationId;

            var innerRecordrows = [];
            if (field.Record) { // handling the nested Record field (inner record)
                var innerRecords = verifyOrMakeArray(field.Record);
                if (field['-id'] && !(GLOBAL_MAPPING[field['-id']])){ // checking if we need to bring more mappings
                    var sonLevelId = findSonLevelId(innerRecords, applicationId, contentId);
                    if (sonLevelId !== null){
                        extendMappingFieldIdToName(sonLevelId);
                    }
                }

                innerRecords.forEach(function(innerRecord){
                /* iterating over the inner records and creating an column and row Object for each of them
                   these objects are used for the human readable of the inner records, and for populating the
                   main record's inner records fields */

                    if(innerRecord){
                        var recordFields = verifyOrMakeArray(innerRecord['Field']);
                        var newModuleId;
                        var newLevelId;
                        if(innerRecord['-moduleId']){ // means that it is a linked record from another module
                            newModuleId = innerRecord['-moduleId'];
                            if (!(newModuleId in seenModuleIds)){ // checking if we need to bring more mappings
                                extendAppIdMapping(newModuleId);
                                seenModuleIds[newModuleId] = newModuleId;
                            }
                        } else if (innerRecord['-levelId']) { // possibly means that it is a linked record from another module
                            newLevelId = innerRecord['-levelId'];
                            if ((newLevelId && newLevelId === "33") || innerRecord['-levelId'] === "33"){
                                return; // buggy level id
                            }
                            if (!(newLevelId in seenLevelIds)){ // checking if we need to bring more mappings
                                extendMappingFieldIdToName(newLevelId);
                                seenLevelIds[newLevelId] = newLevelId;
                            }
                        }

                        var innerRecordObject = {
                            'ModuleId': newModuleId || applicationId,
                            'contentId': innerRecord['-id'],
                            'levelId': innerRecord['-levelId']
                        };
                        if (innerRecordsArray.indexOf(innerRecordObject) === -1){
                            innerRecordsArray.push (innerRecordObject);
                        }
                        var row = {};
                        row['ModuleId'] = newModuleId || applicationId;
                        row['LevelId'] = innerRecord['-levelId'];
                        recordFields.forEach(function (f){
                            row = innerRecordRowBuilder(f, row);
                        });
                        innerRecordrows.push(row);
                    }
                });
            }
            // if there are no items in innerRecordrows we set it to null to ensure that the contexts would have null and not []
            if (innerRecordrows === undefined || innerRecordrows.length === 0){
                innerRecordrows = null;
            }

            var fieldName;
            var levelId;
            var files;
            var dateValue;
            var usersValue;

            if (field['Users']){
                usersValue = userFieldHandler(field['Users']);
                fieldName = GLOBAL_MAPPING[field['-id']].Name;
            }
            else if (field['-value'] !== undefined && dateRe.test(field['-value'])){ // a datetime field
                dateValue = getOccurredTime(field['-value'], 0);
                fieldName = GLOBAL_MAPPING[field['-id']].Name;
            }
            else if (field['-fileID']){ // attached files
                files = getFilesString(field);
                fieldName = 'files';
            } else if (field['-id'] && (GLOBAL_MAPPING[field['-id']])){
                fieldName = GLOBAL_MAPPING[field['-id']].Name;
                levelId = GLOBAL_MAPPING[field['-id']].levelId;
            } else { // in the edge case that we don't have the mapping of the field
                fieldName = field['-id'];
                levelId = " ";
            }

            recordVals.push({
                FieldId: field['-id'],
                FieldName: fieldName,
                FieldType: field['-type'],
                Value: usersValue || dateValue || groupValue || field['-value'] ||innerRecordrows || files,
                LevelId: levelId
            });
        });

        recordVals.push({
            FieldName: 'innerRecords',
            Value: innerRecordsArray,
            FieldId: " ",
            LevelId: " ",
            FieldType: " "
        });
    }
    return recordVals;
}

function getRecordInnerRecordsValues(fields, applicationId){
    /* we have inner records who are linked to the record we are working on.
       innerRecordsTable will have the data related to the linked records */

    var innerRecordsTable = [];
    if (fields) {
        fields.forEach(function (field) {
            // innerRecordrows and innerRecordcolumns are used to create the table of the inner records
            var innerRecordrows = [];
            if (field.Record) { // handling the nested Record field (inner record)
                var innerRecords = verifyOrMakeArray(field.Record);
                var tableName;
                if (field['-id'] && (GLOBAL_MAPPING[field['-id']])){
                    tableName = GLOBAL_MAPPING[field['-id']].Name;
                }else{  // handling the edge case that we are missing mappings
                    tableName = field['-id'];
                }

                var innerRecordcolumns = [];

                innerRecords.forEach(function(innerRecord){
                /* iterating over the inner records and creating an column and row Object for each of them
                   these objects are used for the human readable of the inner records, and for populating the
                   main record's inner records fields */

                    if(innerRecord){
                        var row = {};
                        var recordFields = verifyOrMakeArray(innerRecord['Field']);
                        var newModuleId;
                        var newLevelId;
                        if(innerRecord['-moduleId']){ // means that it is a linked record from another module
                            newModuleId = innerRecord['-moduleId'];
                        }

                        innerRecordcolumns.push('ModuleId');
                        row['ModuleId'] = newModuleId || applicationId;

                        innerRecordcolumns.push('LevelId');
                        row['LevelId'] = innerRecord['-levelId'];

                        var innerRecordObject = {
                            'ModuleId': row['ModuleId'],
                            'contentId': innerRecord['-id'],
                            'levelId': innerRecord['-levelId']
                        };
                        recordFields.forEach(function (f){
                            // building the columns of the inner records table
                            if (GLOBAL_MAPPING[f['-id']] && innerRecordcolumns.indexOf(GLOBAL_MAPPING[f['-id']].Name) === -1){
                                innerRecordcolumns.push(GLOBAL_MAPPING[f['-id']].Name);
                            }else if (f['-id'] && !GLOBAL_MAPPING[f['-id']] &&  innerRecordcolumns.indexOf(f['-id']) === -1){
                                // in case of an edge case where we don't have the mapping
                                innerRecordcolumns.push(f['-id']);
                            }
                            // building a row of the inner records table
                            row = innerRecordRowBuilder(f, row);
                        });
                        innerRecordrows.push(row);
                    }
                });
                innerRecordsTable.push([tableName, innerRecordcolumns, innerRecordrows]);
            }

        });
    }
    return innerRecordsTable;
}

function getRecordAttachments(fields){
    /* we have files attached to the record we are getting to Demisto.
       attachedFiles would be an array with the data needed to download the record's attached files
       attachedFiles = [{fileId: 111, fileName: "abc"}, {...}] */

    var attachedFiles = [];
    if (fields) {
        fields.forEach(function (field) {
            if (field['-fileID']){ // attached files
                var filesArr = getFilesArr(field);
                attachedFiles = attachedFiles.concat(filesArr);
            }
        });
    }
    return attachedFiles;
}

function innerRecordRowBuilder(field, row){
    var users;
    var rowValue;
    if (field['Users']){
        rowValue = userFieldHandler(field['Users']);
    } else if (field['-value'] !== undefined && dateRe.test(field['-value'])){ // datetime field
        rowValue = getOccurredTime(field['-value'], 0);
    } else {
        rowValue = field['-value'] || " ";
    }

    if(GLOBAL_MAPPING[field['-id']] && GLOBAL_MAPPING[field['-id']].Name){
        row[GLOBAL_MAPPING[field['-id']].Name] = rowValue;
    }else if (field['-id'] && !GLOBAL_MAPPING[field['-id']]){
        // in case of an edge case where we don't have the mapping
        row[field['-id']] = rowValue;
    }
    return row;
}

function getFilesString(field){
    var files = "";
    files += "fileID: " + field['-fileID'] + " fileName: " + field['-fileName'];
    if (field['MultiValue']){ // means we have more than one attached files
        var filesArr = verifyOrMakeArray(field['MultiValue']);
        for(var i=0; i<filesArr.length; i++){
            var innerFile = filesArr[i];
            files += ", fileID: " + innerFile['-fileID'] + " fileName: " + innerFile['-fileName'];
        }
    }
    return files;
}

function getGroupsString(groups){
    var group = groups.Group;
    var groupValue;
    if (group) {
        group = verifyOrMakeArray(group);
        group.forEach(function (gr) {
            groupValue = groupValue ? groupValue + ',' + gr['-name'] : gr['-name']
        })
    }
    return groupValue;
}

function getFilesArr(field){
    var filesArr = [];
    filesArr.push({"fileID": field['-fileID'], "fileName":field['-fileName']});
    if (field['MultiValue']){ // means we have more than one attached files
        var innerFilesArr = verifyOrMakeArray(field['MultiValue']);
        for(var i=0; i<innerFilesArr.length; i++){
            var innerFile = innerFilesArr[i];
            filesArr.push({"fileID": innerFile['-fileID'], "fileName":innerFile['-fileName']});
        }
    }
    return filesArr;
}

function userFieldHandler(usersField){
    var users = " ";
    if(usersField['User']){
    // "User": {"-firstName":"Sh","-id":"208","-lastName":"S","-middleName":"S@a.com","-updateDate":"4/18/2017","-updateLogin":"208"}
        var user = usersField['User'];
        if (Array.isArray(usersField['User'])){
            usersField['User'].forEach(function (user){
                if (user['-middleName'] !== undefined && user['-middleName'].length > 0) {
                    users += user['-firstName'] + " " + user['-middleName'] + " " + user['-lastName'];
                }
                else {
                    users += user['-firstName'] + " " + user['-lastName'];
                }
            })
        } else{
            if (user['-middleName'] !== undefined && user['-middleName'].length > 0) {
                users = user['-firstName'] + " " + user['-middleName'] + " " + user['-lastName'];
            }
            else {
                users = user['-firstName'] + " " + user['-lastName'];
            }
        }


    }else{
        users = usersField;
    }
    return users;
}

function findSonLevelId(innerRecords, applicationId, contentId){
    /* Archer has a known bug of bringing records from another module without their correct module id.
       To solve this issue we look inside the inner records and look for the records father. We get the
       father record and then get the original record's correct level id from the father inner records
       as the original record is his son. Later on we will use this level id to get the correct mappings
       for the original record */

    var sonLevelId = null;
    var foundFather = null;
    var fatherModuleId;
    var fatherContentId;
    for( var i = 0 ; i < innerRecords.length; i++){
        if(innerRecords[i]['-moduleId']){ // means that it is a linked record from another module
            fatherModuleId = innerRecords[i]['-moduleId'];
        }else{
            fatherModuleId = applicationId;
        }
        fatherContentId = innerRecords[i]['-id'];
        // linked record father should have the level id of the record, from it we would get the right mapping
        var fatherJSON = getRecordJSON(commands.getRecord, fatherContentId, fatherModuleId);
        if (fatherJSON !== {}){
            var fatherInnerRecords = verifyOrMakeArray(fatherJSON.Record.Field);
            for( var j = 0 ; j < fatherInnerRecords.length; j++){
                if(fatherInnerRecords[j].Record){
                    if (fatherInnerRecords[j].Record['-id'] === contentId){
                        sonLevelId = fatherInnerRecords[j].Record['-levelId'];
                        // now we found the correct levelId
                        foundFather = true;
                        break;
                    }
                }
            }
        }
        if (foundFather){
            break;
        }
    }
    return sonLevelId;
}

function createContentContext (recordId, records) {
    var context = {};
    records.forEach(function (r) {
        context[r.FieldName] = r.Value;
    });
    context.Id = recordId;
    return context;
}

function createKeyValsForFetch (recordId, records) {
    var keyVals = {};
    records.forEach(function (r) {
        keyVals[r.FieldName] = r.Value;
    });
    keyVals.recordId = recordId;
    return keyVals;
}

function downloadFile(fileId){
    // download file from Archer
    rawResponse = downloadFileSendSoapRequest(commands.getFile, fileId);
    var response = JSON.parse(x2j(rawResponse));
    var fileResponse = extractObjectFromXML(response, 'Envelope.Body.GetAttachmentFileResponse.GetAttachmentFileResult');

    var fileData = fileResponse['files']['file']['#text'];
    var fileName = fileResponse['files']['file']['-name'];

    return [fileData,fileName];

}

function getRecordJSON(command, contentId, applicationId) {
    var contentId = contentId || args.contentId;
    var applicationId = applicationId || args.applicationId;
    extendAppIdMapping(applicationId);
    var rawResponse;
    var response;
    rawResponse = getRecordSendSoapRequest(command, applicationId, contentId);

    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        logInfo("getRecordJSON couldn't find the specified record with contentId:" + JSON.stringify(contentId) + " rawResponse = " + JSON.stringify(rawResponse));
        return {};
    }
    try {
        response = JSON.parse(x2j(rawResponse));
    }
    catch(err){
        logError('getRecordJSON error is ' + JSON.stringify(err));
    }

    var parsedJSON = extractObjectFromXML(response, 'Envelope.Body.GetRecordByIdResponse.GetRecordByIdResult');
    return parsedJSON;
}

function getFullRecord(contentId, moduleId) {
    /* getFullRecord is used to get the full record data(including full data on its inner records) */

    var seenRecords = {};
    // used later on to check if we need to bring more mappings
    var seenModuleIds = {};
    seenModuleIds[moduleId] = moduleId;

    // Getting base record
    var record = getRecord(commands.getRecord, contentId, moduleId, false)[0].keyValsForFetch;

    // iterating over the base records inner records and getting their entire object
    var innerRecords = verifyOrMakeArray(record.innerRecords); // contains all possible inner records
    innerRecords.forEach(function (innerRecord){
        if (innerRecord){
            if (innerRecord.levelId === "33"){ //buggy record type in Archer
                return;
            }
            var innerRecordContentId = innerRecord.contentId;
            if (seenRecords[innerRecordContentId]){
                innerRecord.Record = seenRecords[innerRecordContentId];
            } else {
                var innerRecordModuleId = innerRecord.ModuleId || args.applicationId;
                if(innerRecordModuleId && !(innerRecordModuleId in seenModuleIds)){
                    // we have an inner record from another module, so we bring the field mappings of the new module
                    extendAppIdMapping(innerRecordModuleId);
                    seenModuleIds[innerRecordModuleId] = innerRecordModuleId;
                }
                var recordRes = getRecord(commands.getRecord, innerRecordContentId, innerRecordModuleId, false);
                var innerRecordRes = recordRes.length > 0 ? recordRes[0].keyValsForFetch : innerRecord;
                innerRecord.Record = innerRecordRes;
                seenRecords[innerRecordContentId] = innerRecordRes;
            }
        }
    });

    return record;
}

function createIncidentsArr(records, dataArgs){
    logDebug("Entering createIncidentsArr");

    var incidents = [];
    var lastTime;
    var details = "";

    if (records && records.Contents && records.Contents.length > 0) {
        for (var i = 0; i < records.Contents.length; i++) {
            details = "";
            logDebug("Number of records is: {0}".format(records.Contents.length));
            var res = records.Contents[i];
            logDebug("Current value of res is: {0}".format(JSON.stringify(res)));
            logDebug("Current value of res.Fields is: {0}".format(JSON.stringify(res.Fields)));
            var labels = [];
            var fields = Object.keys(res.Fields);
            logDebug("Current value of fields is: {0}".format(fields.toString()));
            if (fields) {
                logDebug("Number of fields is: {0}".format(fields.length));
                for (var j = 0; j < fields.length; j++) {
                    logDebug("Currently handling field number {0}".format(j.toString()));
                    var fieldName = fields[j];
                    var fieldValue;
                    fieldValue = res.Fields[fieldName];
                    logDebug("Current field name is {0}".format(fieldName));
                    if (fieldName === "Record" || fieldName == "innerRecords"){
                        var recordValues = fieldValue;
                        Object.keys(recordValues).forEach(function(key) {
                            if (key === "Date Created") {

                                if(params.useEuropeanTime) {
                                    lastTime = getOccurredTime(recordValues[key], 0);

                                } else {
                                    lastTime = recordValues[key];
                                }
                            }
                            if (recordValues[key] !== null && recordValues[key] !== undefined){
                                if (Array.isArray(recordValues[key])){ // array of nested objects
                                    labels.push({ 'type': key, 'value': JSON.stringify(recordValues[key])});
                                } else {
                                    labels.push({ 'type': key, 'value': recordValues[key]});
                                    if (key.toLowerCase().indexOf("details") !== -1 || key.toLowerCase().indexOf("summary") !== -1){
                                        details += key + ':' + '\n' + recordValues[key] + '\n';
                                    }
                                }
                            }
                        });
                    } else {
                        if (fieldValue !== null && fieldValue !== undefined){
                            if (Array.isArray(fieldValue)){ // array of nested objects
                                labels.push({ 'type': fieldName, 'value': JSON.stringify(fieldValue)});
                                if (fieldName === "attachedFiles"){
                                    fieldValue.forEach(function(val){
                                        var innerDic = {};
                                        innerDic["attachedFiles->FileID"] = val['fileID'];
                                        labels.push(innerDic);
                                    });
                                } else if (fieldName !== "innerRecords" && fieldValue.length === 1){
                                    for (var i = 0 ; i< fieldValue.length; i++ ){
                                        var obj = fieldValue[i];
                                        for (var key in obj) {
                                            if (obj.hasOwnProperty(key)){
                                                var innerDic = {};
                                                if (key !== "ModuleId" && key !== "LevelId"){
                                                    innerDic[fieldName + '->'+ key] = obj[key];
                                                    labels.push(innerDic);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            else {
                                labels.push({ 'type': fieldName, 'value': fieldValue });
                            }
                            if (fieldName.toLowerCase().indexOf("details") !== -1 || fieldName.toLowerCase().indexOf("summary") !== -1){
                                details += fieldName + ':' + ' \n' + fieldValue + '\n';
                            }
                        }
                    }
                    if (fieldName === "Date Created") {
                        if(params.useEuropeanTime) {
                            lastTime = getOccurredTime(fieldValue, 0);
                        } else {
                            lastTime = fieldValue;
                        }
                    }
                }
            }
            var raw = JSON.stringify(res);
            labels.push({ 'type': 'ModuleId', 'value': dataArgs.applicationId});
            labels.push({ 'type': 'ContentId', 'value': res.Id});
            labels.push({ 'type': 'rawJSON', 'value': raw });

            incidents.push({
                name: 'RSA Archer Incident: ' + res.Id,
                labels: labels,
                details: details,
                rawJSON: raw,
                occurred: lastTime
            });
        }
    }
    return incidents;
}

function buildIncident(records, contentId, moduleId){
    var labels = [];
    var lastTime;
    var details = "";

    if (records) {
        var fields = Object.keys(records);
        if (fields) {
            for (var j = 0; j < fields.length; j++) {
                var fieldName = fields[j];
                var fieldValue;
                fieldValue = records[fieldName];
                var labelDic = {}
                if (fieldName === "Record"){
                    var recordValues = fieldValue;
                    Object.keys(recordValues).forEach(function(key) {
                        if (key === "Date Created") {
                            if(params.useEuropeanTime) {
                                lastTime = getOccurredTime(recordValues[key], 0);
                            } else {
                                lastTime = recordValues[key];
                            }
                        }
                        if (recordValues[key] !== null && recordValues[key] !== undefined){
                            if (Array.isArray(recordValues[key])){ // array of nested objects
                                labelDic[key] = JSON.stringify(recordValues[key]);
                            } else {
                                labelDic[key] = recordValues[key];
                                if (key.toLowerCase().indexOf("details") !== -1 || key.toLowerCase().indexOf("summary") !== -1){
                                    details += key + ':' + '\n' + recordValues[key] + '\n';
                                }
                            }
                            labels.push(labelDic);
                        }
                    });
                } else {
                    if (fieldValue !== null && fieldValue !== undefined){
                        if (Array.isArray(fieldValue)){ // array of nested objects
                            labelDic[fieldName] = JSON.stringify(fieldValue);
                            if (fieldName === "attachedFiles"){
                                fieldValue.forEach(function(val){
                                    var innerDic = {};
                                    innerDic["attachedFiles->FileID"] = val['fileID'];
                                    labels.push(innerDic);
                                });
                            } else if (fieldName !== "innerRecords"){
                                for (var i = 0 ; i< fieldValue.length; i++ ){
                                    var obj = fieldValue[i];
                                    for (var key in obj) {
                                        if (obj.hasOwnProperty(key)){
                                            var innerDic = {};
                                            if (key !== "ModuleId" && key !== "LevelId"){
                                                innerDic[fieldName + '->'+ key] = obj[key];
                                                labels.push(innerDic);
                                            }
                                        }
                                    }
                                }
                            }
                        }else{
                            labelDic[fieldName] = fieldValue;
                        }
                        labels.push(labelDic);
                    }
                    if (fieldName.toLowerCase().indexOf("details") !== -1 || fieldName.toLowerCase().indexOf("summary") !== -1){
                        details += fieldName + ':' + ' \n' + fieldValue + '\n';
                    }
                }
                if (fieldName === "Date Created") {
                    if(params.useEuropeanTime) {
                        lastTime = getOccurredTime(fieldValue, 0);
                    } else {
                        lastTime = fieldValue;
                    }

                }
            }
        }
        var raw = JSON.stringify(records);
        labels.push({ 'ModuleId': moduleId});
        labels.push({ 'ContentId': contentId});
        labels.push({'rawJSON': raw });

        return {
            name: 'RSA Archer Incident: ' + contentId,
            labels: labels,
            details: details,
            rawJSON: raw,
            occurred: lastTime
        };
    }
}

function getContentIdsFromIncIds(applicationId, incidentIds){
    // gets the content ids of the respective incident ids from Archer

    var contentIdsArr = [];
    var displayFields = params.fieldsToDisplay || "Incident ID";
    var incidentIdsString = "";
    var incidentIdsArr = incidentIds.split(",");
    for(var i = 0; i <incidentIdsArr.length ; i++){
        incidentIdsString += "INC-" + incidentIdsArr[i] + " ";
    }

    var levelId = getLevelsByApplicationId(applicationId);
    var nameToFieldMapping = createMappingNameToFieldId(levelId);

    var response = getContentIdsByIncIdsSendSoapRequest(applicationId, displayFields, incidentIdsString, levelId, nameToFieldMapping[displayFields].Id);
    var rawResponse = JSON.parse(x2j(response));
    var parsedJSON = extractObjectFromXML(rawResponse, 'Envelope.Body.ExecuteSearchResponse.ExecuteSearchResult');
    if (!Array.isArray(parsedJSON)){
        var recordsArr = verifyOrMakeArray(parsedJSON.Records.Record);
        recordsArr.forEach(function (record){
            contentIdsArr.push(record['-contentId']);
        });
    }

    return contentIdsArr;
}

function getSubformId(fieldId, applicationId, fieldValues, valueForSubform) {
    var result;
    /* Used to get the id of a subform field*/
    if (params.useRest){
    // in case that the user wants to use the REST API
        var levels = getLevelsByApplicationId(applicationId);
        var content = {
            "Content": {
                "LevelId": levels[0],
                "FieldContents": {
                    "29906": {
                        'Type': 1,
                        'FieldId': 29906,
                        'Value': valueForSubform
                     }
                }
            },
            "SubformFieldId": fieldId
        };

        var resp = sendRestRequest('/api/core/content', commands.getSubformId, content, false);
        try {
            result = resp['RequestedObject']['Id'];
        } catch (err) {
            throw "Archer didn't create a new record. We received the following response " + JSON.stringify(resp)
        }
    } else {
        // use the SOAP API
        var SOAPAction = 'http://archer-tech.com/webservices/CreateSubformRecord';
        var token;
        var response;
        for (var i=0; i<15; i++){
            var cache = getIntegrationContext();
            // if we don't have token
            if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
                token = cache["token"];
            } else {
                token = getAuthToken();
                var dic = {};
                dic["token"] = token;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
            }
            var soap = getContentSubFormSoapRequest(token, applicationId, fieldId, fieldValues);
            try {
                response = JSON.parse(x2j(sendSoapRequest(commands.getRecord, soap, SOAPAction)));
                break;
            } catch (err) {
                if (i==14){
                    throw "Archer didn't create a new record. We received the following response " + JSON.stringify(response);
                }
                token = getAuthToken();
                var dic = {};
                dic["token"] = token;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
            }
        }
        result = dq(response, 'Envelope.Body.CreateSubformRecordResponse.CreateSubformRecordResult');
    }
    return result;
}

function verifyFieldsToValue(appFieldMapping, fieldsToValueJSON, appID) {
    // For each application ID, the records of that application ID have different fields.
    // This function verifies the fields specified in the fieldsToValue argument are known by Archer to be compatible with the given app ID.
    var userSpecifiedFields = Object.keys(fieldsToValueJSON);
    var actualFieldsOfGivenApp = Object.keys(appFieldMapping);
    userSpecifiedFields.forEach(function(fieldSpecifiedByUser) {
        if (!(actualFieldsOfGivenApp.indexOf(fieldSpecifiedByUser) > -1)) {
            var wrongFieldErrorMessage = "Error: you've specified the following field in the arg fieldsToValues: {0}, which does not exist for records of the app ID: {1}. \n".format(fieldSpecifiedByUser, appID);
            var possibleFieldsForGivenAppIDMessage = "The allowed fields for application ID {0} are {1}".format(appID, JSON.stringify(actualFieldsOfGivenApp));
            throw (wrongFieldErrorMessage + possibleFieldsForGivenAppIDMessage);
        }
    })
}

function getGroupIDFromGroupName(groupsDataFromArcher, userSuppliedGroupName) {
    var desiredGroupID = -1;
    for (var i=0; i<groupsDataFromArcher.length; i++){
        var currentArcherGroupData = groupsDataFromArcher[i].RequestedObject;
        var currentArcherGroupName = currentArcherGroupData.Name;
        if (currentArcherGroupName.trim().toLowerCase() === userSuppliedGroupName.trim().toLowerCase()){
            desiredGroupID = currentArcherGroupData.Id;
        }
    }
    return desiredGroupID;
}


function getUserIDFromUserName(allUsersArcherData, userSuppliedUserName) {
    var desiredUserID = -1;
    for (var i=0; i<allUsersArcherData.length; i++){
        var currentArcherUserData = allUsersArcherData[i].RequestedObject;
        var currentArcherUserName = currentArcherUserData.UserName;
        if (currentArcherUserName.trim().toLowerCase() === userSuppliedUserName.trim().toLowerCase()){
            desiredUserID = currentArcherUserData.Id;
        }
    }
    return desiredUserID;
}


function getGroupData() {
    var groupsData = sendRestRequest("/api/core/system/group", 'archer-create-record', '', true);
    return groupsData;
}

function getUserData() {
    var userData = sendRestRequest("/api/core/system/user", 'archer-create-record', '', true);
    return userData;
}


// integration commands functions
function replaceMultiselectNameWithID(fieldsToValues, createRecordMapping) {
    var modifiedfieldsToValues = fieldsToValues;
    var allGroupsArcherData = getGroupData();
    var allUsersArcherData = getUserData();
    for (var fieldName in fieldsToValues) {
        if (createRecordMapping[fieldName]) {
            var fieldValue = fieldsToValues[fieldName];
            var fieldNameMapping = createRecordMapping[fieldName];
            var fieldType = fieldNameMapping.Type;
            var isFieldTypeMultiselect = fieldType === 8;

            if (isFieldTypeMultiselect) {
                fieldValue = (typeof fieldValue === "string") ? JSON.parse(fieldValue) : fieldValue;
                var groupsFromUser = fieldValue.groups;
                var usersListFromUser = fieldValue.users;

                if (!(groupsFromUser == null)) {
                    var groupsWithIDsInsteadOfNames = [];
                    for (var groupIndex = 0; groupIndex < groupsFromUser.length; groupIndex++) {
                        var currentUserSuppliedGroupName = groupsFromUser[groupIndex];
                        var currentGroupID = getGroupIDFromGroupName(allGroupsArcherData, currentUserSuppliedGroupName)

                        groupsWithIDsInsteadOfNames.push(currentGroupID);
                    }

                    fieldValue['groups'] = groupsWithIDsInsteadOfNames;
                    modifiedfieldsToValues[fieldName] = fieldValue;
                }

                if (!(usersListFromUser == null)) {
                    var usersWithIDsInsteadOfNames = [];
                    for (var userIndex = 0; userIndex < usersListFromUser.length; userIndex++) {
                        var currentUserSuppliedUserName = usersListFromUser[userIndex];
                        var currentUserID = getUserIDFromUserName(allUsersArcherData, currentUserSuppliedUserName);

                        usersWithIDsInsteadOfNames.push(currentUserID);
                    }

                    fieldValue['users'] = usersWithIDsInsteadOfNames;
                    modifiedfieldsToValues[fieldName] = fieldValue;
                }
            }
        }
    }
    return modifiedfieldsToValues;

}

function createRecord(command, dataArgs) {
    // corresponds to 'archer-create-record' command. Creates a new record in Archer
    logDebug("Entering createRecord");
    var contentId;
    var levels;
    var createRecordMapping;
    var appId = dataArgs.applicationId;
    var fieldsToValue = JSON.parse(dataArgs.fieldsToValues);
    var fieldsToValueKeys = Object.keys(fieldsToValue);
    logDebug("App ID is: {0}, \n Fields To Value keys are: {1}".format(appId, fieldsToValueKeys.toString()));
    if (fieldsToValue === null || typeof fieldsToValue !== 'object') {
        throw 'Invalid Argument fieldToValue';
    }

    var cache = getIntegrationContext();
    if (Object.keys(cache).length > 0 && isKeyInCache(appId)) {
        levels = cache[appId]["levels"];
        createRecordMapping = cache[appId]["mapping"];
        logDebug("createRecordMapping is: {0}".format((JSON.stringify(createRecordMapping))));
        verifyFieldsToValue(createRecordMapping, fieldsToValue, appId);

    } else {
        levels = getLevelsByApplicationId(appId);
        createRecordMapping = createMappingNameToFieldId(levels);
        logDebug("createRecordMapping is: {0}".format((JSON.stringify(createRecordMapping))));
        verifyFieldsToValue(createRecordMapping, fieldsToValue, appId);
        var dic = {};
        var innerDic = {};
        innerDic["levels"] = levels;
        innerDic["mapping"] = createRecordMapping;
        dic[appId] = innerDic;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
    }

    if (params.useRest){
        // in case that the user wants to use the REST API
        fieldsToValue = replaceMultiselectNameWithID(fieldsToValue, createRecordMapping);
        logDebug("Using REST API");
        var content = {
            "Content": {
                "LevelId": levels[0],
                "FieldContents": createFieldsContentsObject(fieldsToValue, createRecordMapping)
            }
        };

        var resp = sendRestRequest('/api/core/content', command, content, false);
        try {
            contentId = resp['RequestedObject']['Id'];
        } catch (err) {
            throw "Error: Archer returned an error and didn't create a new record.";
        }

    } else {
        // use the SOAP API
        logDebug("Using SOAP API");
        var token;
        var fields = inputToXML(fieldsToValue, createRecordMapping);
        var rawResponse;

        for (var i=0; i<15; i++){
            var cache = getIntegrationContext();
            // if we don't have token
            if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
                token = cache["token"];
            } else {
                token = getAuthToken();
                var dic = {};
                dic["token"] = token;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
            }
            var soap = createContentSoapRequest(token, appId, fields);
            var SOAPAction = 'http://archer-tech.com/webservices/CreateRecord';
            try {
                rawResponse = sendSoapRequest(command, soap, SOAPAction);
                break;
            } catch (err) {
                if (i==14){
                    throw "Error: Archer returned an error and didn't create a new record. ";
                }
                token = getAuthToken();
                var dic = {};
                dic["token"] = token;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
            }
        }
        var response = JSON.parse(x2j(rawResponse));

        if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
            throw "Error in response. Request = " + soap + " Response = " + rawResponse;
        }

        contentId = dq(response, 'Envelope.Body.CreateRecordResponse.CreateRecordResult');
    }

    var md = JSON.parse(JSON.stringify(fieldsToValue));
    md.Id = contentId;

    if (!contentId) {
        return {
            ContentsFormat: formats["markdown"],
            Type: entryTypes["error"],
            Contents: "Received an error" + JSON.stringify(response)
        };
    }

    return {
        Type: entryTypes.note,
        Contents: {
            "CreateRecordResult": contentId
        },
        ContentsFormat: formats.json,
        HumanReadable: tableToMarkdown(command, md),
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
            'Archer.Record(val.Id==obj.Id)': {
                Id: contentId,
                Fields: fieldsToValue
            }
        }
    };
}

function updateRecord(command, dataArgs) {
    // corresponds to 'archer-update-record' command. Updates the field/s of a record in Archer
    logDebug("Entering updateRecords");

    var appId = dataArgs.applicationId;
    var contentId = dataArgs.contentId;
    var fieldsToValue;
    if (typeof dataArgs.fieldsToValue === 'object'){
        fieldsToValue = dataArgs.fieldsToValue;
    } else {
        fieldsToValue = JSON.parse(dataArgs.fieldsToValues);
    }
    var incidentId = dataArgs.incidentId;
    if (incidentId){
        contentId = getContentIdsFromIncIds(appId, incidentId)[0];
    }
    if (fieldsToValue === null || typeof fieldsToValue !== 'object') {
        throw 'Invalid Argument fieldToValue';
    }
    var fieldsToValueKeys = Object.keys(fieldsToValue);
    logDebug("App ID is: {0}, \n Fields To Value keys are: {1}".format(appId, fieldsToValueKeys.toString()));

    var cache = getIntegrationContext();
    var updateRecordMapping;
    if (Object.keys(cache).length > 0 && isKeyInCache(appId) ) {
        levels = cache[appId]["levels"];
        updateRecordMapping = cache[appId]["mapping"];
        logDebug("updateRecordMapping value is: {0}".format(JSON.stringify(updateRecordMapping)));
    } else {
        levels = getLevelsByApplicationId(appId);
        updateRecordMapping = createMappingNameToFieldId(levels);
        logDebug("updateRecordMapping value is: {0}".format(JSON.stringify(updateRecordMapping)));
        var dic = {};
        var innerDic = {};
        innerDic["levels"] = levels;
        innerDic["mapping"] = updateRecordMapping;
        dic[appId] = innerDic;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
    }

    if (params.useRest){
        // in case that the user wants to use the REST API
        fieldsToValue = replaceMultiselectNameWithID(fieldsToValue, updateRecordMapping);
        var content = {
            "Content": {
                "Id": contentId,
                "LevelId": levels[0],
                "FieldContents": createFieldsContentsObject(fieldsToValue, updateRecordMapping)
            }
        };

        var resp = sendRestRequest('/api/core/content', commands.updateRecordREST, content, false);

        try {
            contentId = resp['RequestedObject']['Id'];
        } catch (err) {
            throw "Error: Archer returned an error and didn't update any record.";
        }

    } else {
        // use the SOAP API
        var token;
        var rawResponse;
        var fields = inputToXML(fieldsToValue, updateRecordMapping);

        for (var i=0; i<15; i++){
            var cache = getIntegrationContext();
            // if we don't have token
            if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
                token = cache["token"];
            } else {
                token = getAuthToken();
                var dic = {};
                dic["token"] = token;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
            }
            var soap = updateContentSoapRequest(token, appId, contentId, fields);
            var SOAPAction = 'http://archer-tech.com/webservices/UpdateRecord';
            try {
                rawResponse = sendSoapRequest(command, soap, SOAPAction);
                break;
            } catch (err) {
                if (i==14){
                    throw "Error: Archer returned an error and didn't update any record.";
                }
                token = getAuthToken();
                var dic = {};
                dic["token"] = token;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
            }
        }

        var response = JSON.parse(x2j(rawResponse));
        if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
            throw "Error in response. Request = " + soap + " Response = " + rawResponse;
        }

        var result = dq(response, 'Envelope.Body.UpdateRecordResponse.UpdateRecordResult');
        if (!result && result < 1) {
            return {
                ContentsFormat: formats["markdown"],
                Type: entryTypes["error"],
                Contents: "Received an error" + JSON.stringify(response)
            };
        }
    }

    return {
        Type: entryTypes.note,
        ContentsFormat: formats.json,
        Contents: {
            "updatedRecord": contentId
        },
        ReadableContentsFormat: formats.markdown,
        HumanReadable: 'content id = ' + contentId + ' was updated successfully'
    }
}

function getRecord(command, contentId, applicationId, saveFiles) {
    /* corresponds to 'archer-get-record' command. Gets record from Archer to the war room.
       the logic of this function can be splitted into three parts:
         1) it gets the raw record object from Archer with "getRecordSendSoapRequest" and parses it into parsedJSON.
         2) it builds an clearly defined and parsed record object, including details about its inner records. That
            happens during "getRecordContentMapping".
         3) it constructs the reply object where reply[0] is always the record itself, and the other items in the array
            would be each of the record's attached files.
       this function is also used extensively in searchRecords. */

    var contentId = contentId || args.contentId;
    var applicationId = applicationId || args.applicationId;
    var response;
    var attachedFilesMarkdown;
    var incidentId = args.incidentId;

    if (incidentId){
        contentId = getContentIdsFromIncIds(applicationId, incidentId)[0];
    }
    extendAppIdMapping(applicationId);
    var rawResponse = getRecordSendSoapRequest(command, applicationId, contentId);
    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        logInfo("We couldn't find the specified record with contentId:" + JSON.stringify(contentId) + " rawResponse = " + JSON.stringify(rawResponse));
        return [];
    }
    try {
        response = JSON.parse(x2j(rawResponse));
    }
    catch(err){
        logError('getRecord response parse error is ' + JSON.stringify(err));
    }

    var parsedJSON = extractObjectFromXML(response, 'Envelope.Body.GetRecordByIdResponse.GetRecordByIdResult');
    var recordFields = parsedJSON.Record.Field;
    /* important - the order of these lines matters(!). getRecordInnerRecordsValues relays on the fact that
       getRecordContentMapping brings the required mappings for this record and its linked records */
    var contentMapping = getRecordContentMapping(recordFields, applicationId, contentId, saveFiles);
    var innerRecordValues =  getRecordInnerRecordsValues(recordFields, applicationId);
    var innerRecordsMarkdown = createInnerRecordsHumanReadable(innerRecordValues);
    var attachedFiles = getRecordAttachments(recordFields);

    var keyValsForFetch = createKeyValsForFetch(contentId, contentMapping);
    keyValsForFetch.attachedFiles = attachedFiles;
    var record = JSON.parse(JSON.stringify(keyValsForFetch));
    record.innerRecords = innerRecordValues;

    var reply = [];
    reply.push({
        Type: entryTypes.note,
        Contents: record,
        keyValsForFetch: keyValsForFetch,
        ContentsFormat: formats.json,
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
          'Archer.Record(val.Id==obj.Id)': createContentContext(contentId, contentMapping)
        }
    });
    if (attachedFiles.length > 0){
        if (saveFiles){
        // we have files attached to the record that we want to save we download them and save them to the context
            for (var i = 0 ; i< attachedFiles.length; i++){
                var fileInfo = downloadFile(attachedFiles[i]['fileID']);
                var fileData = fileInfo[0];
                var fileName = fileInfo[1];
                var demistoFileId = saveFile(fileData, undefined, true);
                attachedFiles[i]['demistoFileId'] = demistoFileId;
                reply.push({Type: 3, FileID: demistoFileId, File: fileName, Contents: fileName, ArcherFileId: attachedFiles[i]['fileID']});
            }
            attachedFilesMarkdown = tableToMarkdown('Attached files', attachedFiles, ['fileID', 'fileName', 'demistoFileId']);
        } else { // we don't want to download the files at the moment
            attachedFilesMarkdown = tableToMarkdown('Attached files', attachedFiles, ['fileID', 'fileName']);
        }
    }
    reply[0]['HumanReadable'] = tableToMarkdown(command, contentMapping) + '\n\n' + innerRecordsMarkdown + '\n\n' + attachedFilesMarkdown;
    return reply;
}

function getListOfApplications(command) {
    // corresponds to 'archer-search-applications' command. Returns the list of applications in Archer

    var body = '';
    var applicatInfo = [];
    var queryParams = '';
    if (args.findByName !== undefined) {
        body = { Value: "?$filter=Name eq '" + args.findByName + "'" };
    } else if (args.findById) {
        queryParams = '/' + args.findById;
    }

    var applictions = sendRestRequest('/api/core/system/application', command, body, true, queryParams)

    if (!Array.isArray(applictions)) {
        applictions = [applictions];
    }

    applictions.forEach(function (app) {
        var record = app.RequestedObject;
        if (record) {
            applicatInfo.push({
                Type: record.Type,
                LanguageId: record.LanguageId,
                Id: record.Id,
                Name: record.Name,
                Guid: record.Guid,
                Status: record.Status
            })
        }
    });

    return {
        Type: entryTypes.note,
        Contents: applicatInfo,
        ContentsFormat: formats.json,
        HumanReadable: tableToMarkdown(command, applicatInfo),
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
            'Archer.Applications': applicatInfo
        }
    };
}


function getFieldIdInReverseMapping(idToNameMapping, fieldNameToSearch) {
    for (var fieldID in idToNameMapping) {
        var currentFieldData = idToNameMapping[fieldID];
        if ("Name" in currentFieldData && currentFieldData["Name"] === fieldNameToSearch) {
            return fieldID;
        }
    }
    return '';
}


function searchRecords(command, dataArgs) {
    /* corresponds to 'archer-search-records' command. Returns records from Archer who matches the user's
       search criteria. Looks for incident ids from Archer and then gets each one of them in getSearchRecords
       by using the getRecord function. */
    logDebug("Entering searchRecords");

    var appId = dataArgs.applicationId;
    var fieldsToDisplay = dataArgs.fieldsToDisplay;
    var maxResults = dataArgs.maxResults;
    var fieldToSearchOn = dataArgs.fieldToSearchOn;
    var searchValue = dataArgs.searchValue;
    var numericOperator = dataArgs.numericOperator;
    var dateOperator = dataArgs.dateOperator;

    logDebug("App ID is: {0}, \n Search value is: {1}".format(appId, searchValue));

    var isDescending = dataArgs.isDescending === 'true';
    var pageNumber = dataArgs.pageNumber || '1';
    var fetchFilter = dataArgs.fetchFilter;
    var getInnerRecords = dataArgs.getInnerRecords === 'true';
    var fullData = dataArgs.fullData === 'true';

    var cache = getIntegrationContext();
    var nameToFieldMapping;
    if (Object.keys(cache).length > 0 && isKeyInCache(appId)) {
        levels = cache[appId]["levels"];
        nameToFieldMapping = cache[appId]["mapping"];
        logDebug("nameToFieldMapping value is: {0}".format(JSON.stringify(nameToFieldMapping)));
    } else {
        levels = getLevelsByApplicationId(appId);
        nameToFieldMapping = createMappingNameToFieldId(levels);
        logDebug("nameToFieldMapping value is: {0}".format(JSON.stringify(nameToFieldMapping)));
        var dic = {};
        var innerDic = {};
        innerDic["levels"] = levels;
        innerDic["mapping"] = nameToFieldMapping;
        dic[appId] = innerDic;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
    }
    // fills the global mapping
    extendMappingFieldIdToName(levels);

    var fields = '';

    if (fieldsToDisplay && !Array.isArray(fieldsToDisplay)){
        fieldsToDisplay = fieldsToDisplay.split(',');
    }

    if (!fieldsToDisplay) {
        fieldsToDisplay = ["Incident ID"];
    }
    if (fieldsToDisplay) {
        fieldsToDisplay.forEach(function (field) {
            if (field && field !== "undefined" && nameToFieldMapping[field] !== undefined) {
                fields += '<DisplayField name="' + escapeXMLChars(field) +'">' + nameToFieldMapping[field].Id + '</DisplayField>';
            }
        });
    }
    logDebug("Fields to display is: {0}".format(fieldsToDisplay))
    var fieldIdToSearchOn;
    var fieldNameToSearchOn;
    if (fieldToSearchOn && searchValue) { // the user entered search parameters
        isFieldNameInMapping = nameToFieldMapping[fieldToSearchOn] && typeof nameToFieldMapping[fieldToSearchOn] !== 'undefined';
        fieldIdToSearchOn = isFieldNameInMapping ? nameToFieldMapping[fieldToSearchOn].Id : '';
        if (fieldIdToSearchOn === '') {
            fieldIdToSearchOn = getFieldIdInReverseMapping(nameToFieldMapping, fieldToSearchOn)
        }
        fieldNameToSearchOn = fieldToSearchOn;
    }else{ // performing a general search
        fieldNameToSearchOn = "Date Created";
        isFieldNameInMapping = nameToFieldMapping[fieldNameToSearchOn] && typeof nameToFieldMapping[fieldNameToSearchOn] !== 'undefined';
        fieldIdToSearchOn = isFieldNameInMapping? JSON.stringify(nameToFieldMapping[fieldNameToSearchOn].Id) : '';
        if (fieldIdToSearchOn === '') {
            fieldIdToSearchOn = getFieldIdInReverseMapping(nameToFieldMapping, fieldNameToSearchOn)
        }
        dateOperator = "GreaterThan";
        var day = 60 * 1000 * 60 * 24;
        searchValue = toDateArcherString(new Date(new Date().getTime() - (day * 31)));
    }
    logDebug("Field name to search on is: {0}".format(fieldToSearchOn))
    logDebug("Fields to search on is: {0}".format(fieldsToDisplay))
    var rawResponse = searchSendSoapRequest(
        command,
        appId,
        fields,
        maxResults,
        fieldIdToSearchOn,
        fieldNameToSearchOn,
        searchValue,
        fieldIdToSearchOn,
        isDescending,
        numericOperator,
        dateOperator,
        pageNumber,
        fetchFilter);

    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        logInfo("We couldn't find records in searchRecords: rawResponse = " + JSON.stringify(rawResponse));
        return [];
    }
    try {
        response = JSON.parse(x2j(rawResponse));
    }
    catch(err){
        throw ('searchRecords response parse error is ' + JSON.stringify(err));
    }
    var parsedJson = extractObjectFromXML(response, 'Envelope.Body.ExecuteSearchResponse.ExecuteSearchResult');
    var output = getSearchRecords(parsedJson, getInnerRecords, fullData);
    var md = [];
    output.forEach(function (out) {
        md.push(treeToFlattenObject(out));
    });

    return {
        Type: entryTypes.note,
        Contents: output,
        ContentsFormat: formats.json,
        HumanReadable: tableToMarkdown(command, md),
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
            'Archer.Record(val.Id==obj.Id)': output
        }
    };
}

function getAppFields() {
    // corresponds to 'archer-get-application-fields' command. Returns the values of a specific field id in Archer

    var levels = getLevelsByApplicationId(args.applicationId);
    var appFieldsMapping = createMappingFieldIdToName(levels);
    var md = [];
    for (var fieldId in appFieldsMapping) {
        md.push({
            FieldId: fieldId,
            FieldName: appFieldsMapping[fieldId].Name,
            FieldType: appFieldsMapping[fieldId].Type,
            LevelId: appFieldsMapping[fieldId].levelId
        })
    }

    return {
        Type: entryTypes.note,
        Contents: md,
        ContentsFormat: formats.json,
        HumanReadable: tableToMarkdown(command, md),
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
            'Archer.ApplicationFields(val.FieldId === obj.FieldId)': md
        }
    };
}

function deleteRecord(command, dataArgs) {
    // corresponds to 'archer-delete-record' command. Deletes a record from Archer

    var appId = dataArgs.applicationId;
    var contentId = dataArgs.contentId;
    var incidentId = dataArgs.incidentId;
    if (incidentId){
        contentId = getContentIdsFromIncIds(appId, incidentId)[0];
    }
    var token = getAuthToken();
    var soap =  deleteContentSoapRequest(token, appId, contentId);
    var SOAPAction = 'http://archer-tech.com/webservices/DeleteRecord';
    var rawResponse = sendSoapRequest(command, soap, SOAPAction);
    var response = JSON.parse(x2j(rawResponse));

    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        throw "Error in response. Request = " + soap + " Response = " + rawResponse;
    }

    var result = dq(response, 'Envelope.Body.DeleteRecordResponse.DeleteRecordResult');
    if (!result && result < 1) {
        return {
            ContentsFormat: formats.markdown,
            Type: entryTypes.error,
            Contents: "Recived an error while deleting record: " + JSON.stringify(response)
        };
    }

    return {
        Type: entryTypes.note,
        Contents: 'content id = ' + contentId + ' was deleted successfully'
    }
}

function getValueObjectForFieldId(dataArgs){
    // corresponds to 'archer-get-field' command. Returns the values of a specific field id in Archer

    var fieldID = dataArgs.fieldID;
    var levels = getLevelsByApplicationId(args.applicationId);
    var mapping = createMappingFieldIdToName(levels);
    var result = mapping[fieldID];
    try {
        result.FieldId = fieldID;
    } catch (e){
        //no match for this fieldID
    }
    return result;
}

function fetchIncidents(dataArgs) {
    // corresponds to 'archer-fetch-incidents' scenario. Fetch incidents from an specific module in Archer
    logDebug("Entering fetch incidents");

    var myTimezone = new Date().getTimezoneOffset() * -1;
    var tz = params.timeZone ? parseInt(params.timeZone) : myTimezone;
    if (params.timeZone === '0') {
        tz = 0;
    }

    // The offset is given in milliseconds, thus multiplying by 1000.
    offset = tz ? 60 * 1000 * parseInt(tz) : 60 * 1000 * new Date().getTimezoneOffset();

    var cmd = commands.searchRecords;
    var incidentRes = [];
    var lastRun = getLastRun();

    var day = 60 * 1000 * 60 * 24;
    var lastTime = lastRun.lastTime;
    var shouldAddOffset = false;
    if (!lastTime) {
        shouldAddOffset = true;
        lastTime = new Date().getTime() - (day * 1);
    }
    dataArgs.applicationId = dataArgs.applicationId || params.fetchApplicationId ;
    dataArgs.dateOperator = 'GreaterThan';
    dataArgs.searchValue = toDateArcherString(new Date(lastTime));
    dataArgs.fieldToSearchOn = "Date Created";
    dataArgs.fieldsToDisplay = dataArgs.fieldsToDisplay || params.fieldsToDisplay || "Incident ID";
    dataArgs.isDescending = 'false';
    dataArgs.fetchFilter = params.fetchFilter;
    dataArgs.getInnerRecords = 'true';
    dataArgs.fullData = 'true';


    logDebug("Entering searchRecords from fetch incidents");
    var results = searchRecords(cmd, dataArgs);
    var incidents = createIncidentsArr(results, dataArgs.applicationId);
    logDebug("Incidents returned are: {0}".format(incidents.toString()));
    if (incidents.length > 0){
        shouldAddOffset = true;
        lastTime = incidents[incidents.length-1].occurred;
        lastTime = lastTime.getTime()
    }
    var newLastTime = shouldAddOffset ? lastTime + offset : lastTime;
    logDebug("New last time is: {0}".format(newLastTime))
    setLastRun({ lastTime: newLastTime});
    return (JSON.stringify(incidents));
}

function getReports(command) {
    // corresponds to 'archer-get-reports' command. Gets all the existing Archer reports

    var token = getAuthToken();
    var soap = getReportsSoapRequest(token);
    var SOAPAction = 'http://archer-tech.com/webservices/GetReports';
    var rawResponse = sendSoapRequest(command, soap, SOAPAction);
    destroyAuthToken(token);
    var response = JSON.parse(x2j(rawResponse));

    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        throw "Error in response. Request = " + soap + " Response = " + rawResponse;
    }

    var parsedJSON = extractObjectFromXML(response, 'Envelope.Body.GetReportsResponse.GetReportsResult');

    return {
        Type: entryTypes.note,
        Contents: parsedJSON,
        ContentsFormat: formats.json,
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
            'Archer.Report(val.ReportGUID==obj.ReportGUID)': parsedJSON
        }
    };
}

function executeStatisticSearchByReport(command, dataArgs) {
    // corresponds to 'archer-execute-statistic-search-by-report' command. Performs a statistic search on a specific Archer report

    var maxResults = dataArgs.maxResults || '100';
    var reportGuid = dataArgs.reportGuid;
    var token = getAuthToken();

    var soap = executeStatisticSearchByReportSoapRequest(token, reportGuid, maxResults);
    var SOAPAction = 'http://archer-tech.com/webservices/ExecuteStatisticSearchByReport';
    var rawResponse = sendSoapRequest(command, soap, SOAPAction);
    destroyAuthToken();
    var response = JSON.parse(x2j(rawResponse));

    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        throw "Error in response. Request = " + soap + " Response = " + rawResponse;
    }

    var parsedJSON = extractObjectFromXML(response, 'Envelope.Body.ExecuteStatisticSearchByReportResponse.ExecuteStatisticSearchByReportResult');

    return {
        Type: entryTypes.note,
        Contents: parsedJSON,
        ContentsFormat: formats.json,
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
            'Archer.StatisticSearch(true)': parsedJSON
        }
    };
}

function getSearchOptionsByGuid(command, dataArgs) {
    // corresponds to 'archer-get-search-options-by-guid' command. Gets the search option for a specific Archer report

    var reportGuid = dataArgs.reportGuid;
    var token = getAuthToken();
    var soap = getSearchOptionsByGuidSoapRequest(token, reportGuid);
    var SOAPAction = 'http://archer-tech.com/webservices/GetSearchOptionsByGuid';
    var rawResponse = sendSoapRequest(command, soap, SOAPAction);
    destroyAuthToken();
    var response = JSON.parse(x2j(rawResponse));

    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        throw "Error in response. Request = " + soap + " Response = " + rawResponse;
    }

    var parsedJSON = extractObjectFromXML(response, 'Envelope.Body.GetSearchOptionsByGuidResponse.GetSearchOptionsByGuidResult');

    return {
        Type: entryTypes.note,
        Contents: parsedJSON,
        ContentsFormat: formats.json,
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
            'Archer.SearchOptions(true)': parsedJSON
        }
    };
}

function searchRecordsByReport(command, dataArgs) {
    // corresponds to 'archer-search-records-by-report' command. Search records by a specific Archer report

    var reportGuid = dataArgs.reportGuid;
    var currentPage = 1;
    var moreRecords = true;
    var searchResults = {
        "RecordsAmount": "",
        "Records": [],
        "FieldDefinitions": []
    }
    do {
        var token = getAuthToken();
        var soap = searchRecordsByReportSoapRequest(token, reportGuid, currentPage);
        var SOAPAction = 'http://archer-tech.com/webservices/SearchRecordsByReport';
        var rawResponse = sendSoapRequest(command, soap, SOAPAction);
        destroyAuthToken(token);
        var response = JSON.parse(x2j(rawResponse));

        if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
            throw "Error in response. Request = " + soap + " Response = " + rawResponse;
        }
        var parsedJSON = extractObjectFromXML(response, 'Envelope.Body.SearchRecordsByReportResponse.SearchRecordsByReportResult');
        if (parsedJSON.Records && parsedJSON.Records.Record){
            currentPage += 1;
            searchResults['RecordsAmount'] = parsedJSON.Records['-count'];
            searchResults['Records'].push(parsedJSON.Records.Record);
            searchResults['FieldDefinitions'].push(parsedJSON.Records.Metadata.FieldDefinitions.FieldDefinition)
        } else {
            moreRecords = false;
        }
    } while (moreRecords);


    return {
        Type: entryTypes.note,
        Contents: searchResults,
        ContentsFormat: formats.json,
        ReadableContentsFormat: formats.markdown,
        EntryContext: {
            'Archer.SearchByReport(true)': searchResults
        }
    };
}

function createMappingFieldIdToName(levels) {
    // corresponds to 'archer-get-mapping-by-level' command. Creates a mapping of field id to names according to level ids

    var fieldIdToNameMapping = {};
    if (!levels) {
        throw 'Mapping levels to Fields failed';
    }

    if (!Array.isArray(levels)) {
        levels = [levels];
    }

    levels.forEach(function (lvl) {
        var url = replaceInTemplatesAndRemove(urlDictionary.fieldByLevelId, {
            levelId: lvl
        });
        var fieldsLevelInfo = sendRestRequest(url, 'fieldByLevelId', '', true);

        if (!Array.isArray(fieldsLevelInfo)) {
           fieldsLevelInfo = [fieldsLevelInfo];
        }

        fieldsLevelInfo.forEach(function (field) {
            if (field.RequestedObject.Type !== 25) {
                fieldIdToNameMapping[field.RequestedObject.Id] = {
                    Type: field.RequestedObject.Type,
                    Name: field.RequestedObject.Name,
                    levelId: lvl
                };
            }
        });
    });

    return fieldIdToNameMapping;
}

function manualFetch(args){
    /* corresponds to 'archer-manually-fetch-incident' command. Fetch an incident or several incidents from Archer to Demisto.
       used for the automation which creates a new incident with the following data */

    var incidentIds = args.incidentIds;
    var incidents = [];
    var contentIdsArr;
    var incidentIdsArr = incidentIds.split(",");
    var applicationId = args.applicationId;

    var contentIdsFromInc = getContentIdsFromIncIds(applicationId, incidentIds);

    if (contentIdsFromInc.length > 0){
        contentIdsArr = contentIdsFromInc;
    } else {
        contentIdsArr = incidentIdsArr;
    }

    contentIdsArr.forEach(function (contentId){
        var record = getFullRecord(contentId, applicationId);
        incidents.push(buildIncident(record, contentId, applicationId));
    });
    return incidents;
}

function getFile(args){
    // corresponds to 'archer-get-file' command. Downloads a file from Archer and adds it to the context

    var fileId = args.fileId;
    var fileInfo = downloadFile(fileId);
    var fileData = fileInfo[0];
    var fileName = fileInfo[1];
    var demistoFileId = saveFile(fileData, undefined, true);
    return ({
        Type: 3,
        FileID: demistoFileId,
        File: fileName,
        Contents: fileName
    });
}

function uploadFile(args){
    // corresponds to 'archer-upload-file' command. Uploads a file from Demisto to Archer

    var applicationId = args.applicationId;
    var contentId = args.contentId;
    var incidentId = args.incidentId;
    var entryId = args.entryId;
    var associatedField = args.associatedField;

    if (incidentId){
        contentIdsFromInc = getContentIdsFromIncIds(applicationId, incidentId);
        if (contentIdsFromInc.length > 0){
            contentId = contentIdsFromInc[0];
        } else {
            contentId = incidentId;
        }
    }
    var fileName = dq(invContext, "File(val.EntryID == '" + entryId + "').Name");
    if (fileName === null) {
        fileName = dq(invContext, "InfoFile(val.EntryID == '" + entryId + "').Name");
    }
    if (Array.isArray(fileName)) {
        if (fileName.length > 0) {
            fileName = fileName[0];
        } else {
            fileName = undefined;
        }
    }

    var fileB64String = entrytoa(entryId);
    var body = {"AttachmentName": fileName, "AttachmentBytes": fileB64String};
    var response = sendRestRequest(urlDictionary[commands.uploadFile], commands.uploadFile, body, false);
    if (response['IsSuccessful'] == "false"){
        throw "Uploading failed. Response was: " + JSON.stringify(response);
    }

    var archerFileId = response.RequestedObject.Id;
    var currentFiles = [archerFileId];
    var currentRecord = getRecord(commands.getRecord, contentId, applicationId, true);

    for (var i=1; i<currentRecord.length; i++){
        currentFiles.push(parseInt(currentRecord[i]['ArcherFileId']));
    }
    fieldsToValueObj = {};
    fieldsToValueObj[associatedField] = currentFiles;
    var args = {
        "applicationId": applicationId,
        "contentId": contentId,
        "fieldsToValue": fieldsToValueObj,
        "incidentId": incidentId
    }
    updateRecord(commands.updateRecord, args);
    return "File uploaded successfully";
}

function addToDetailedAnalysis(args){
    // corresponds to 'archer-add-to-detailed-analysis' command. Adds more data to detailed analysis

    var detailedAnalysisArcherIds = [];
    var applicationId = args.applicationId;
    var contentId = args.contentId;
    var incidentId = args.incidentId;
    if (!contentId && !incidentId){
        throw "Please enter either contentId or incidentId of the record";
    }

    if (incidentId){
        contentId = getContentIdsFromIncIds(applicationId, incidentId)[0];
    }
    var value = args.value;

    currentRecord = getRecord(commands.getRecord, contentId, applicationId, false)[0].Contents;
    if (currentRecord['Detailed Analysis']){
        currentDetailedAnalysis = verifyOrMakeArray(currentRecord['Detailed Analysis']);
        currentDetailedAnalysis.forEach(function(item){
            if(item['Notes: Tracking ID']){
                detailedAnalysisArcherIds.push(item['Notes: Tracking ID']);
            }
        })
    }

    var fields = '<Field id="29906" value="' + value +'" />';
    detailedAnalysisArcherIds.push(getSubformId(30186, 411, fields, value));

    var args = {
        "applicationId": applicationId,
        "contentId": contentId,
        "fieldsToValue": {
            "Detailed Analysis": detailedAnalysisArcherIds
        },
        "incidentId": incidentId
    }
    updateRecord(commands.updateRecord, args);

    return "Detailed Analysis updated successfully";
}

function getUserId(args){
    // corresponds to 'archer-get-user-id' command. Retrieves a user id from Archer

    var userInfo = args.userInfo.split("\\");
    var userDomain = userInfo[0];
    var userName = userInfo[1].toLowerCase();

    var token;
    var rawResponse;
    var cache;
    for (var i=0; i<15; i++){
        cache = getIntegrationContext();
        // if we don't have token
        if (Object.keys(cache).length > 0 && Object.keys(cache).indexOf("token") > -1) {
            // there is a lock in place
            var locked = true;
            var total = 0;
            while (Object.keys(cache).indexOf("lock") > -1 && (cache["lock"] === true || cache["lock"] === "true") && locked && cache["valid"]){
                logInfo("Waiting for lock to end");
                total += 2000;
                sleep(2000);
                cache = getIntegrationContext();
                if (cache["lock"] !== true || total > 60000){
                    // breaking lock after 1 minute
                    locked = false;
                }
            }
            // no lock
            if (!(Object.keys(cache).indexOf("lock") > -1) || cache["valid"] !== false){
                token = cache["token"];
                logInfo("Taking token " + token + " from cache")
            } else {
                token = getAuthToken();
                var dic = {};
                dic["token"] = token;
                dic["lock"] = true;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
                logInfo("Token wasn't found in cache, created token: " + token + " and putting it in the cache")
            }
        } else {
            token = getAuthToken();
            var dic = {};
            dic["token"] = token;
            dic["lock"] = true;
            var updatedCache = mergeOptions(cache, dic);
            setIntegrationContext(updatedCache);
            logInfo("Token wasn't found in cache, created token: " + token + " and putting it in the cache")
        }
        var soap = getUserIdSoapRequest(token, userName, userDomain);
        var SOAPAction = 'http://archer-tech.com/webservices/LookupDomainUserId';
        try {
            rawResponse = sendSoapRequest(command, soap, SOAPAction);
            break;
        } catch (err) {
            logInfo('Bad Result from Archer: ' + err + ' request body was: ' + soap);
            // check if we are locked and if there is a new token in place already
            cache = getIntegrationContext();
            var locked = false;
            var total = 0;

            while (Object.keys(cache).indexOf("lock") > -1 && (cache["lock"] === true) && locked){
                logInfo("Waiting for lock to end");
                sleep(2000);
                cache = getIntegrationContext();
                total += 2000;

                if (cache["lock"] !== true || total > 60000){
                    // breaking the lock after 1 minute
                    locked = false;
                }
            }
            if (Object.keys(cache).indexOf("valid") > -1 && cache["valid"] === true && cache["token"] !== token){
                token = cache["token"];
            } else {
                token = getAuthToken();
            }

            var dic = {};
            dic["token"] = token;
            dic["lock"] = true;
            var updatedCache = mergeOptions(cache, dic);
            setIntegrationContext(updatedCache);
            logInfo("Putting a newly token in cache which was generated after an error, token is: " + token);

            if (i==14){
                var dic = {};
                dic["valid"] = false;
                dic["lock"] = false;
                var updatedCache = mergeOptions(cache, dic);
                setIntegrationContext(updatedCache);
                throw "Error in response. Request = " + soap + " Response = " + rawResponse;
            }
            continue;
        }
    }

    var response = JSON.parse(x2j(rawResponse));
    logInfo('Successful get user id request to RSA Archer with session token: ' + token);
    var dic = {};
    dic["token"] = token;
    dic["valid"] = true;
    dic["lock"] = false;
    var updatedCache = mergeOptions(cache, dic);
    setIntegrationContext(updatedCache);
    if (typeof rawResponse !== 'string' || rawResponse.length == 0) {
        throw "Error in response. Request was: " + soap + " Response was: " + rawResponse;
    }

    var userId = response.Envelope.Body.LookupDomainUserIdResponse.LookupDomainUserIdResult;

    return {
        Type: entryTypes.note,
        Contents: {
            "UserId": userId
        },
        ContentsFormat: formats.json,
        ReadableContentsFormat: formats.markdown,
        HumanReadable: "User id for user " + userName + " is " + userId,
        EntryContext: {
            'Archer.getUserId(val.UserId==obj.UserId)': userId
        }
    };
}

function isKeyInCache(key){
    cache = getIntegrationContext();
    if (key in cache && cache[key] !== null) {
        return true;
    }
    return false;
}

function resetIntegrationCache(){
    currentIntegrationContext = getIntegrationContext();
    newIntegrationContext = {}
    keysNotToReset = ["token", "lock", "valid"]
    Object.keys(currentIntegrationContext).forEach(function(key) {
        if (keysNotToReset.indexOf(key) === -1) {
            newIntegrationContext[key] = null
        }
    });
    setIntegrationContext(newIntegrationContext);
}

function test() {
    var isFetch = params.isFetch;
    if (isFetch && !params.fetchApplicationId && !params.fieldsToDisplay) {
        throw 'If Fetch incidents is on, then Application Id and fields to display must be passed';
    }
    if (!getListOfApplications(commands.searchApps).Contents.length > 0){
        throw 'Error in test, list of Applications is empty - possible problem with API connection';
    }
    return 'ok';
}

function mergeDicts(dictA, dictB) {
    newDict = {}
    Object.keys(dictA).forEach(function(key){
        newDict[key] = dictA[key]
    })
    Object.keys(dictB).forEach(function(key){
        newDict[key] = dictB[key]
    })
    return newDict
}

try {
     /*
     current workaround for known missing mapping. If this issue appears again
     it would be better to put missing application ids (such as 411) as integration params.
     it's ok if this fails, the client might not have this module.
     */

    var cache = getIntegrationContext();
    var appId = "411";
    if (Object.keys(cache).length > 0 && isKeyInCache(appId)) {
        newMapping = cache[appId]["mapping"];
        for (var attrname in newMapping) {
            GLOBAL_MAPPING[attrname] = newMapping[attrname];
        }
    } else {
        var levels = getLevelsByApplicationId(appId);
        var mappingIDToName = createMappingFieldIdToName(levels);
        var mappingNameToID = createMappingNameToFieldId(levels);
        newMapping = mergeDicts(mappingIDToName, mappingNameToID);
        for (var attrname in newMapping) {
            GLOBAL_MAPPING[attrname] = newMapping[attrname];
        }
        var dic = {};
        var innerDic = {};
        innerDic["levels"] = levels;
        innerDic["mapping"] = newMapping;
        dic[appId] = innerDic;
        var updatedCache = mergeOptions(cache, dic);
        setIntegrationContext(updatedCache);
        // todo add new levels to the cache
    }
} catch (e) {
}


switch (command) {
    case 'test-module':
        return test();
    case commands.createRecord:
        return createRecord(command, args);
    case commands.getValueList:
        return getValueListJustForField(args);
    case commands.valueListForField:
        return getValueObjectForFieldId(args);
    case commands.updateRecord:
        return updateRecord(command, args);
    case commands.deleteRecord:
        return deleteRecord(command, args);
    case commands.getRecord:
        return getRecord(command, null, null, true);
    case commands.searchApps:
        return getListOfApplications(command);
    case commands.searchRecords:
        return searchRecords(command, args);
    case commands.getAppFields:
        return getAppFields();
    case commands.fetchIncidents:
        return fetchIncidents(args);
    case commands.getReports:
        return getReports(command);
    case commands.executeStatisticSearchByReport:
        return executeStatisticSearchByReport(command, args);
    case commands.getSearchOptionsByGuid:
        return getSearchOptionsByGuid(command, args);
    case commands.searchRecordsByReport:
        return searchRecordsByReport(command, args);
    case commands.getMappingByLevel:
        return createMappingFieldIdToName(args.level);
    case commands.manualFetch:
        return manualFetch(args);
    case commands.getFile:
        return getFile(args);
    case commands.uploadFile:
        return uploadFile(args);
    case commands.addToDetailedAnalysis:
        return addToDetailedAnalysis(args);
    case commands.getUserId:
        return getUserId(args);
    case 'archer-reset-cache':
        return resetIntegrationCache();
    case 'fetch-incidents':
        return fetchIncidents(args);
    default:
        break;
}
