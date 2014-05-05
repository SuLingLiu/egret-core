/**
 * 将TypeScript编译为JavaScript
 */
var path = require("path");
var fs = require("fs");
var async = require('../core/async');
var crc32 = require('../core/crc32');
var cp_exec = require('child_process').exec;
var CRC32BuildTS = "buildTS.local";
var libs = require("../core/normal_libs");
var param = require("../core/params_analyze.js");
var currDir_global;
function run(currDir, args, opts) {
    var u = opts["-u"];
    if (u && u.length > 0) {
        currDir = u[0];
    }
    currDir_global = currDir;


    var copyExample = function (callback) {
        var engine_root = param.getEgretPath();
        var target_src = path.join(currDir, "output", "examples");
        var source_src = path.join(engine_root, "examples");
        libs.copy(source_src, target_src);
        callback();
    }


    var game_path = args[0];
    if (!game_path) {
        libs.exit(1101);
    }

    var clearTS = function (callback) {
        var outPath = path.join(currDir, game_path, "bin-debug");
        var allFileList = generateAllTypeScriptFileList(outPath);
        for (var i = 0; i < allFileList.length; i++) {
            var fileToDelete = path.join(outPath, allFileList[i]);
            libs.deleteFileSync(fileToDelete);
            callback();
        }
    }

    var tasks = [
        function (callback) {
            buildAllFile(path.join(param.getEgretPath(), "src"), path.join(currDir, game_path, "bin-debug/lib"), callback);
        },

        function (callback) {
            buildAllFile(path.join(currDir, game_path, "src"), path.join(currDir, game_path, "bin-debug/src"), callback);
        }
    ];

    tasks.push(clearTS);

    async.series(tasks
    )
}

function getLocalContent() {
    var tempData;
    if (!fs.existsSync(CRC32BuildTS)) {
        tempData = {};
    }
    else {
        var txt = fs.readFileSync(CRC32BuildTS, "utf8");
        tempData = JSON.parse(txt);
    }
    return tempData;
}

function buildAllFile(source, output, callback) {

    async.waterfall([
        checkCompilerInstalled,

        function (callback) {
            compile_temp(callback, source)
        },

        function (filepath,callback){

            build(callback,filepath,output);
        },



        function(result,callback){

            var all_js_file = libs.loopFileSync(source, filter);
            all_js_file.forEach(function(item){
                libs.copy(path.join(source,item),path.join(output,item));
            })

            callback(null);

            function filter(path) {
                return  path.indexOf(".js") > -1
            }
        }






    ], function (err) {

        if (err) {
            libs.exit(err);
        }
        callback();
    })


}

function compile_temp(callback, source) {
    var file = path.join(source, "egret_file_list.js");
    if (fs.existsSync(file)) {
        var js_content = fs.readFileSync(file, "utf-8");
        eval(js_content);
        var output_content = egret_file_list.map(function (item) {

            if (item.indexOf("jslib") >= 0) return "";
            if (item.indexOf("Native") >= 0) return "";
            return "///\<reference path=\"" + item.replace(".js", ".ts") + "\"/>";


        }).join("\n");
        var output_path = path.join(source,"temp.ts");
        fs.writeFileSync(output_path, output_content, "utf-8");
    }
    //todo  refactor
    var file = path.join(source, "game_file_list.js");
    if (fs.existsSync(file)) {
        var js_content = fs.readFileSync(file, "utf-8");
        eval(js_content);
        var output_content = game_file_list.map(function (item) {

            if (item.indexOf("jslib") >= 0) return "";
            if (item.indexOf("Native") >= 0) return "";
            return "///\<reference path=\"" + item.replace(".js", ".ts") + "\"/>";


        }).join("\n");
        var output_path = path.join(source,"temp.ts");
        fs.writeFileSync(output_path, output_content, "utf-8");
    }


    callback(null,output_path);

}


function checkCompilerInstalled(callback) {
    var checkTypeScriptCompiler = "tsc";
    var tsc = cp_exec(checkTypeScriptCompiler);
    tsc.on('exit', function (code) {
            if (code == 0) {
                callback();
            }
            else {
                libs.exit(2);
            }
        }
    );
}

/**
 * 编译单个TypeScript文件
 * @param file
 * @param callback
 */
function build(callback, source, output) {
//    var target = path.join(output,file).replace(".ts",".js");
    var cmd = "tsc " + source + " -t ES5 --outDir " +  output;

    var ts = cp_exec(cmd);
    ts.stderr.on("data", function (data) {
        if (data.indexOf("error TS1") >= 0 ||
            data.indexOf("error TS5") >= 0 ||
            data.indexOf("error TS2105") >= 0) {
            console.log(data);
        }
    })

    ts.on('exit', function (code) {
        fs.unlinkSync(source)
        fs.unlinkSync(path.join(output,"temp.js"));
        callback(null, source);
    });
}

/**
 * 编译全部TypeScript文件
 * @param allFileList
 */
function compileAllTypeScript(crc32Data, allFileList, source, output, buildOver) {
    async.forEachSeries(allFileList, function (file, callback) {
        //console.log(path);
        var fullname = path.join(source, file)
        var content = fs.readFileSync(fullname, "utf8");
        var data = crc32(content);
        if (crc32Data[fullname] == data) {
            //不需要重新编译
            callback(null, file);
        }
        else {
            crc32Data[fullname] = data;
            //需要重新编译一下
            build(file, callback, source, output);
        }


    }, function (err) {
        if (err == undefined) {
            console.log(source + " AllComplete");
        }
        else {
            console.log("出错了" + err);
        }
        //保存一下crc32文件
        txt = JSON.stringify(crc32Data);
        if (fs.existsSync(CRC32BuildTS)) {
            fs.unlinkSync(CRC32BuildTS);
        }
        fs.writeFileSync(CRC32BuildTS, txt);

        buildOver();
    });

}


/**
 * 生成source下的所有TypeScript文件列表
 * @param source
 * @returns {Array}
 */

function generateAllTypeScriptFileList(source) {

    return libs.loopFileSync(source, filter);

    function filter(path) {
        return  path.indexOf(".ts") == path.length - 3 && path.indexOf(".d.ts") == -1
    }
}

exports.run = run;