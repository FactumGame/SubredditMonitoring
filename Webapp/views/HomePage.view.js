/*
My view for this homepage: 
1. Chart on top that you can load different coins into in order to compare data on the same chart
2. A section below this that automatically loads in the top 15 coins 
*/

sap.ui.jsview("sap.crypto.app.views.HomePage", {

   getControllerName: function() {
      return "sap.crypto.app.controllers.HomePage";
   },

   createContent: function(oController) {

        let topHtml = new sap.ui.core.HTML({
            content: '<h1>Subreddits selected in selector above will have their data displayed on the first graph for sake of comparison</h1>'
        });

        var template = new sap.ui.core.ListItem({
            text: '{SubredditModelId>subreddit_name}'
        }),
        subredditSelector = new sap.m.MultiComboBox({
            id: "SubredditSelectorId",
            width: "100%",
            selectionChange: function(oEvent) {
                oController.displaySubredditData(oEvent);
            }
        }).bindItems('SubredditModelId>/subreddits', template); 

        let comparisonChartHtml = new sap.ui.core.HTML({
            content: "<h3>Comparison Chart</h3>" + '<div id="SubredditGraph"></div>'
        });

        var top15DescriptionHtml = new sap.ui.core.HTML({
            content: '<h1>Data for top 15 subreddits displayed below</h1>'
        });

        var top15Html = new sap.ui.core.HTML({
            content: Array.apply(null, {length: 15}).map(Number.call, Number)
                .map(elem => {return elem + 1})
                .reduce((acc, curr) => {
                    return acc +
                    `<h3 id='TopSubreddit${curr}Title'></h3>` +  
                    `<div id='TopSubreddit${curr}'></div>`}
            , "") 
        });

        var layout = new sap.ui.layout.VerticalLayout({
            width: "100%", 
            content: [
                topHtml, 
                subredditSelector, 
                comparisonChartHtml, 
                top15DescriptionHtml, 
                top15Html
            ]
        }); 

        var page = new sap.m.Page({
            content: [
                layout
            ]
        });

        page.onAfterRendering = function(evt) {
            if (sap.m.Page.prototype.onAfterRendering) { //apply any default behavior so we don't override essential things
                sap.m.Page.prototype.onAfterRendering.apply(this);
            }
            oController.afterRender(); 
        };

        return page;
   }

});