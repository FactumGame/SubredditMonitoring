$.sap.require("sap.m.BusyDialog");

sap.ui.jsfragment('sap.crypto.app.views.fragments.GettingTop15SubredditData', {

    createContent: function(oController) {
        return new sap.m.BusyDialog({
            title: 'Querying server for subreddit data'
        });
    }

});