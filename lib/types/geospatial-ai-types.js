"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAnalysisError = exports.DataRetrievalError = void 0;
var DataRetrievalError = /** @class */ (function (_super) {
    __extends(DataRetrievalError, _super);
    function DataRetrievalError(message, status, code, url) {
        var _this = _super.call(this, message) || this;
        _this.status = status;
        _this.code = code;
        _this.url = url;
        _this.name = 'DataRetrievalError';
        return _this;
    }
    return DataRetrievalError;
}(Error));
exports.DataRetrievalError = DataRetrievalError;
var AIAnalysisError = /** @class */ (function (_super) {
    __extends(AIAnalysisError, _super);
    function AIAnalysisError(message, code, details) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.details = details;
        _this.name = 'AIAnalysisError';
        return _this;
    }
    return AIAnalysisError;
}(Error));
exports.AIAnalysisError = AIAnalysisError;
