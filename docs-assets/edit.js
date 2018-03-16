'use strict';


var codeMirrorDefaultHeight = 800;
var myCode1Mirror = CodeMirror.fromTextArea(
  document.getElementById('ocamlcode#1'),
  {
    mode:'text/x-ocaml',
    lineNumbers: true,
    lineWrapping: true,
    styleActiveLine:true,
    theme: "monokai",
    matchBrackets: true,
    autoCloseBrackets: true,
    tabSize: 2,
    keyMap: "sublime",
  } );
myCode1Mirror.setOption("extraKeys", {
  "Cmd-S": function() {
    onEditChanges();
  }
});
var jsCode1Mirror = CodeMirror.fromTextArea(
  document.getElementById('jscode#1'),
  { mode:'javascript',
    lineNumbers:true,
    readOnly: true,
    lineWrapping: true,
    theme: "monokai",
  });

var outputMirror = CodeMirror.fromTextArea(
  document.getElementById('output'),
  {
    mode : 'javascript',
    readOnly: true,
    lineWrapping: true,
    lineNumbers: true,
    theme: "monokai"
  }
);
var errorMirror = CodeMirror.fromTextArea(
  document.getElementById('error'),
  {
    readOnly: true,
    lineWrapping: true,
    lineNumbers : true,
    theme: "monokai"
  }
);
var PROMPT = "" ;
var log_output = PROMPT;
var ERR_OUTPUT = ""
var err_output = ERR_OUTPUT;

function reset_log_output (){ log_output  = PROMPT;}
function reset_error_output(){ err_output = ERR_OUTPUT;}
function get_log_output(){
  var old = log_output;
  reset_log_output();
  return old;
}
function get_error_output(){
  var old = err_output;
  reset_error_output();
  return old;
}
var compile_code ;
// var evalButton = document.getElementById('option-eval');
// var shakeButton = document.getElementById('option-non-export');

function shouldEval(){
  // return evalButton.checked;
  return true;
}
// function onEvalButtonChange(){
//   if(!shouldEval()){
//     outputMirror.setValue(PROMPT);
//   } else {
//     onEditChanges();
//   }
// }
// evalButton.addEventListener('change', onEvalButtonChange);

// function onShakeButtonChange(){
//   if(shakeButton.checked){
//     compile_code = ocaml.shake_compile;
//   }else{
//     compile_code = ocaml.compile;
//   }
//   // onEditChanges();
// }
//
// shakeButton.addEventListener('change', onShakeButtonChange);
var original_log = console.log;
var original_err = console.error;

/**
 * TODO: simulate commonjs in browser
 * */
var exports = window;

function redirect() { log_output = log_output + Array.prototype.slice.apply(arguments).join(' ') + "\n"};

function redirect_err() {
    err_output = err_output + Array.prototype.slice.apply(arguments).join(' ') + "\n"
};

myCode1Mirror.setSize(null,codeMirrorDefaultHeight);
outputMirror.setSize(null,50);
outputMirror.setValue(PROMPT + 'Hello BuckleScript!');
errorMirror.setSize(null,50);
errorMirror.setValue(ERR_OUTPUT);

var sourceLocation = ""
if (typeof window.location !== "undefined"){
    sourceLocation = "\n//# sourceURL=" + window.location.href + "/repl.js"
}

function evalCode(js){
  console.log = redirect;
  try {
    window.eval(js + sourceLocation);
    outputMirror.setValue(get_log_output());
    //console.log = original_log;
  }
  catch(e){
    outputMirror.setValue(get_log_output() + "\n" + e);
    //console.log = original_log;
  }

}

function createExample(name){
    var li = document.createElement('li');
    var a = document.createElement('a')
    a.setAttribute('href', '#' + name);
    a.setAttribute('data-key', name);
    a.appendChild(document.createTextNode(name))
    li.appendChild(a)
    return li
}

var examplesDropdown = document.getElementById("examplesDropdown")
var examplesDataSet ;


//Event handler for examples dropdown
$('#examplesDropdown').click(clickHandler);

function switchExample(id){
  var filename = "";
  var jsfilename = "";
  var example = examplesDataSet [id];
  if (example){
      filename = "examples/" + example.file;
  }
  $.ajax({
    url: filename,
    cache: true
  })
  .done(function (response) {
    myCode1Mirror.setValue(response);
    var rsp = compile(response)
    if (rsp.js_code !== undefined) {
      evalCode(rsp.js_code)
    } else {
      // jsCode1Mirror.setValue(rsp.js_error_msg);
      errorMirror.setValue(rsp.js_error_msg);
    }
  });

  //update dropdown label
  $('#examplesLabel').html(id + ' <span class="caret"></span>');
}

function clickHandler(e) {
    var id = e.target.getAttribute('data-key');
    switchExample(id)
}

function readFile(filename, cb) {
  var rawFile = new XMLHttpRequest();
  rawFile.open("GET", filename, false);
  rawFile.onreadystatechange = function () {
    if (rawFile.readyState === 4 && (rawFile.status === 200 || rawFile.status === 0)) {
      return cb(rawFile.responseText);
    }
    else {
      return 0;
    }
  };
  return rawFile.send(null);
}


console.log = function redirectLog(s){
  outputMirror.replaceRange(s+"\n", {line: Infinity});
}

function compile(src){
  if(typeof compile_code === 'undefined'){
    compile_code = ocaml.compile;
  }
  function stripWarnings(s){
    if (!s.startsWith("Warning: You are passing a OCaml bool type into JS") &&
        !s.startsWith("File \"\"")){
      redirect_err(s);
    }
  }
  console.error = stripWarnings;
  if (predefinedStuff !== null) {
    var converted = window.refmt(src, 'RE', 'implementation', 'ML');
    if (converted[0] == "REtoML") {
      var raw = compile_code(predefinedStuff + "\n#0 \"example.re\"\n" + converted[1]);
      errorMirror.setValue(get_error_output());
      outputMirror.setValue("");
      var rsp = JSON.parse(raw); // can we save this from parsing?
      console.error = original_err;
      return rsp;
    } else if (converted[0] == "REtoUnkown") {
      console.error = original_err;
      return {js_error_msg: converted[1]}
    }
  } else {
    return {js_error_msg: "Reprocessing lib not yet loaded."}
  }
}

var predefinedStuff;

readFile('Reprocessing_Ext.re', function(str) {
  var converted = window.refmt(str, 'RE', 'implementation', 'ML')
  predefinedStuff = converted[1];
});

function onEditChanges(cm, change) {
  var rsp = compile(myCode1Mirror.getValue());
  if (rsp.js_code !== undefined) {
    cancelAnimationFrame(document.getElementById("main-canvas").__hiddenrafid);
    evalCode(rsp.js_code)
  } else {
    //jsCode1Mirror.setValue(rsp.js_error_msg);
    errorMirror.setValue(rsp.js_error_msg);
  }
}

function onRefmtChanges(cm, change) {
  // var refmted = document.refmt(myCode1Mirror.getValue()).c;
  console.error("WHAT")
  var refmted = window.refmt(myCode1Mirror.getValue(), 'RE', 'implementation', 'RE')
    if (refmted[0] == "REtoRE") {
      myCode1Mirror.setValue(refmted[1]);
    } else if (refmted[0] == "REtoUnkown") {
      errorMirror.setValue(refmted[1]);
    }
}
// myCode2Mirror.on("changes", onEditChanges);

//jsCode1Mirror.setSize(null,codeMirrorDefaultHeight);



//checks or unchecks the eval button
// function changeEvalButton(bool) {
//   $('#option-eval').prop('checked', bool);
//   onEvalButtonChange();
// }

//creates a gist from OCaml code
$('#share').click(function (e) {
  var state = $(this).button('loading');
  var request =
  {
    "description": "BuckleScript Gist",
    "public": true,
    "files": {
      "gist.ml": {
        "content": myCode1Mirror.getValue()
      }
    }
  };

  $
    .ajax({ url:'https://api.github.com/gists',
            type: 'POST',
            data: JSON.stringify(request)
          })
    .done(function (response) {
      state.button('reset');
      $('#shareModal').modal('show');
      var url = 'https://schmavery.github.io/reprocessing/?gist=' + response.id;
      $('#shareModalBody').html('<a href=' + '"' + url + '"' + 'target="_blank"' + '>' + url + '</a>');
    })
    .error(function (err) {
      state.button('reset');
      $('#shareModal').modal('show');
      $('#shareModalBody').text('Sorry! Currently GitHub\'s API limits the number of requests we can send per hour. Please try again later.');
    })
});

//copy link to clipboard
var copy = new Clipboard('#copyButton');
copy.on('success', function(e) {
  e.clearSelection();
  $('#copyGlyph').attr('class', 'glyphicon glyphicon-ok');
});

//reset clipboard icon when modal is closed
$('#shareModal').on('hidden.bs.modal', function (e) {
  $('#copyGlyph').attr('class', 'glyphicon glyphicon-copy');
});