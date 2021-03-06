resp = executeCommand("D2ActiveUsers", {});
if (isError(resp[0])) {
    return resp;
}

data = dq(resp[0],'Contents');
if (!data) {
    return { ContentsFormat: formats.text, Type: entryTypes.error, Contents: 'No Active Users were found' };
}
users = [];
data.forEach(function(u){
            var user = {};
            var username = null;
            var domain = null;
            user = dq(u,"Antecedent");
            user = user.split(",");

            if (user.length === 2) {
                try {
                    domain = user[0].split('=')[1].replace(/['"]+/g, '')
                    username = user[1].split('=')[1].replace(/['"]+/g, '')
                } catch (ex) {
                    return ex;
                }
            }

            if(domain && username && !users.some(e => e.Username == username && e.Domain == domain)) {
                users.push({'Username' : username, 'Domain' : domain});
            }
        });

var md = tableToMarkdown("Users", users);
var ec = {"Account(val.Username == obj.Username)" : users};
return ( {'ContentsFormat': formats.json, 'Type': entryTypes.note, 'Contents': users, "HumanReadable": md, "EntryContext": ec} );
