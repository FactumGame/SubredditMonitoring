$.sap.require("sap.m.BusyDialog");

sap.ui.jsfragment('sap.crypto.app.views.fragments.GettingSubredditData', {

    createContent: function(oController) {
        return new sap.m.BusyDialog({
            title: 'Querying server for subreddit data'
        });
    }

});