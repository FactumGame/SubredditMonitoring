$.sap.require('sap.crypto.app.Utility.HighstockJsonFormatter');

sap.ui.define([
   "sap/ui/core/mvc/Controller"
], function (Controller) {
   "use strict";
   return Controller.extend("sap.crypto.app.controllers.HomePage", {

        onInit: function() {

            let subredditModel  = new sap.ui.model.json.JSONModel({}), 
                core            = sap.ui.getCore(); 
            subredditModel.setSizeLimit(150);
            core.setModel(subredditModel, "SubredditModelId");  
        },

        afterRender: function() {

            let subredditModel  = sap.ui.getCore().getModel("SubredditModelId"),
                controller      = this; 

            let busyDialog = sap.ui.jsfragment('sap.crypto.app.views.fragments.GettingSubredditNames');
            $.sap.syncStyleClass('sapUiSizeCompact', this.getView(), busyDialog);
            busyDialog.open();

            $.ajax({
                url: '/subreddit_names/',
                success: function(response) {
                    let data = response['subreddit_names'];
                    data = data.map((elem) => {
                        return {
                            "subreddit_name": elem, 
                            "data": []
                        }; 
                    }); 
                    subredditModel.setData({"subreddits": data}); 
                    subredditModel.refresh(true);
                    setTimeout(() => {
                        busyDialog.close(); 
                        setTimeout(() => {
                            controller.getTop15SubredditData();
                        }, 500);
                    }, 1500);   
                }
            });
        },

        getTop15SubredditData: function() {

            let core            = sap.ui.getCore(), 
                subredditModel  = core.getModel("SubredditModelId"); 

            let busyDialog = sap.ui.jsfragment('sap.crypto.app.views.fragments.GettingTop15SubredditData');
            $.sap.syncStyleClass('sapUiSizeCompact', this.getView(), busyDialog);
            busyDialog.open();

            $.ajax({
                url: '/top_15_subreddits_by_growth/',
                success: function(response) {
                    let data = response['subredditData'], 
                        dataMap = data.reduce((accumulator, current) => {
                            accumulator[current.name] = current.data; 
                            return accumulator; 
                        }, {}),
                        subData = subredditModel.getData()['subreddits'];
                    for (let i = 0; i < subData.length; i++) {
                        let curr = subData[i]; 
                        if (dataMap.hasOwnProperty(curr.subreddit_name)) {
                            subData[i] = {
                                "subreddit_name": curr.subreddit_name, 
                                "data": dataMap[curr.subreddit_name]
                            }; 
                        }
                    } 
                    subredditModel.setData({"subreddits": subData}); 
                    subredditModel.refresh(true);
                    setTimeout(() => {
                        HIGHSTOCK_JSON_FORMATTER.processAndPlotTopFifteenSubreddits(data);
                        busyDialog.close(); 
                    }, 1500);
                }
            });
        },

        displaySubredditData: function(oEvent) {

            let core = sap.ui.getCore(),
                controller = this,
                selector = core.byId("SubredditSelectorId"),
                selectedItems = selector.getSelectedItems(),
                model = core.getModel("SubredditModelId"),
                data = model.getData()['subreddits'],
                requestSubreddit = -1; //fill with url we wish to request from. We only ever need to request from 1 url
            
            selectedItems = selectedItems.map(function(elem) {
                return elem.mProperties.text;
            }); 

            data.forEach(function(elem) {
                if (elem.data.length !== 0 || $.inArray(elem.subreddit_name, selectedItems) === -1) {
                    //1. this element already had it's data loaded in so do nothing
                    //2. element is not currently selected so we ignore it
                } else {
                    //we need to queue up this url to request data from
                    requestSubreddit = elem.subreddit_name;
                    console.log('need to make new request for ' + elem.subreddit_name); 
                    return; 
                }
            });

            //if there are requests to be made, we show busy dialog while requesting data
            let busyDialog = sap.ui.jsfragment('sap.crypto.app.views.fragments.GettingSubredditData');
            let makingRequests = false;

            if (requestSubreddit !== -1) {
                makingRequests = true;
                $.sap.syncStyleClass('sapUiSizeCompact', this.getView(), busyDialog);
                busyDialog.open();
            }

            $.when(
                $.ajax({
                    url: "subreddits/" + requestSubreddit
                })
            ).done(function(response) {
                let currSubreddit = response['subreddit'];
                for (var x = 0; x < data.length; x++) {
                    if (data[x].subreddit_name === currSubreddit) {
                        data[x] = {
                            "subreddit_name": currSubreddit,
                            "data": response['data']
                        };
                        break;
                    }
                }
                model.setData({
                    "subreddits": data
                });
                model.refresh(true);
                busyDialog.close();

                console.log("plotting comparison chart"); 
                console.log(selectedItems); 
                controller.plotData(selectedItems);
            });

            if (!makingRequests) {
                console.log("plotting comparison chart"); 
                console.log(selectedItems); 
                controller.plotData(selectedItems);
            }

        }, 

        plotData: function(selectedSubredditNames) {

            var core = sap.ui.getCore(),
                model = core.getModel("SubredditModelId"),
                data = model.getData()['subreddits'];

            console.log(data); 

            HIGHSTOCK_JSON_FORMATTER.processAndPlotSubredditData(selectedSubredditNames, data);
        } 

   });
});