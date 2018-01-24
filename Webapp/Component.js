sap.ui.define([
   "sap/ui/core/UIComponent"
], function (UIComponent) {
   "use strict";
   return UIComponent.extend("sap.crypto.app.Component", {
        metadata : {
            manifest: "json",
            rootView: {
              "viewName": "sap.crypto.app.views.App",
              "type": "JS"
            }
	    },
        init : function () {

            UIComponent.prototype.init.apply(this, arguments);
            var oRouter = this.getRouter();
            oRouter.register('router');
            oRouter.initialize();

      }
   });
});