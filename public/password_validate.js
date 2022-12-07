/*
 * jQuery Minimun Password Requirements 1.1
 * http://elationbase.com
 * Copyright 2014, elationbase
 * Check Minimun Password Requirements
 * Free to use under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
*/
 
(function($){$.fn.extend({passwordRequirements:function(options){var defaults={numcharacters:8,useLowercase:true,useUppercase:true,useNumbers:true,useSpecial:true,infoMessage:'',style:"light",fadeTime:300};options=$.extend(defaults,options);return this.each(function(){var o=options;o.infoMessage='The minimum password length is '+o.numcharacters+' characters and must contain at least 1 lowercase letter, 1 capital letter 1 number and 1 special character.'; var numcharactersUI='<li class="pr-numcharacters"><span></span># of characters</li>',useLowercaseUI='',useUppercaseUI='',useNumbersUI='',useSpecialUI='';if(o.useLowercase===true){useLowercaseUI='<li class="pr-useLowercase"><span></span>Lowercase letter</li>';} if(o.useUppercase===true){useUppercaseUI='<li class="pr-useUppercase"><span></span>Capital letter</li>';} if(o.useNumbers===true){useNumbersUI='<li class="pr-useNumbers"><span></span>Number</li>';} if(o.useSpecial===true){useSpecialUI='<li class="pr-useSpecial"><span></span>Special character</li>';} var messageDiv='<div id="pr-box"><i></i><div id="pr-box-inner"><p>'+o.infoMessage+'</p><ul>'+numcharactersUI+useLowercaseUI+useUppercaseUI+useNumbersUI+useSpecialUI+'</ul></div></div>';var numcharactersDone=true,useLowercaseDone=true,useUppercaseDone=true,useNumbersDone=true,useSpecialDone=true;var showMessage=function(){if(numcharactersDone===false||useLowercaseDone===false||useUppercaseDone===false||useNumbersDone===false||useSpecialDone===false){$(".pr-password").each(function(){var posH=$(this).offset().top,itemH=$(this).innerHeight(),totalH=posH+itemH,itemL=$(this).offset().left;$("body").append(messageDiv);$("#pr-box").addClass(o.style).fadeIn(o.fadeTime).css({top:totalH,left:itemL});});}};$(this).on("focus",function(){showMessage();});var deleteMessage=function(){var targetMessage=$("#pr-box");targetMessage.fadeOut(o.fadeTime,function(){$(this).remove();});};var checkCompleted=function(){if(numcharactersDone===true&&useLowercaseDone===true&&useUppercaseDone===true&&useNumbersDone===true&&useSpecialDone===true){deleteMessage();}else{showMessage();}};$(this).on("blur",function(){deleteMessage();});var lowerCase=new RegExp('[a-z]'),upperCase=new RegExp('[A-Z]'),numbers=new RegExp('[0-9]'),specialcharacter=new RegExp('[!,%,&,@,#,$,^,*,?,_,~]');$(this).on("keyup focus",function(){var thisVal=$(this).val();checkCompleted();if(thisVal.length>=o.numcharacters){$(".pr-numcharacters span").addClass("pr-ok");numcharactersDone=true;}else{$(".pr-numcharacters span").removeClass("pr-ok");numcharactersDone=false;} if(o.useLowercase===true){if(thisVal.match(lowerCase)){$(".pr-useLowercase span").addClass("pr-ok");useLowercaseDone=true;}else{$(".pr-useLowercase span").removeClass("pr-ok");useLowercaseDone=false;}} if(o.useUppercase===true){if(thisVal.match(upperCase)){$(".pr-useUppercase span").addClass("pr-ok");useUppercaseDone=true;}else{$(".pr-useUppercase span").removeClass("pr-ok");useUppercaseDone=false;}} if(o.useNumbers===true){if(thisVal.match(numbers)){$(".pr-useNumbers span").addClass("pr-ok");useNumbersDone=true;}else{$(".pr-useNumbers span").removeClass("pr-ok");useNumbersDone=false;}} if(o.useSpecial===true){if(thisVal.match(specialcharacter)){$(".pr-useSpecial span").addClass("pr-ok");useSpecialDone=true;}else{$(".pr-useSpecial span").removeClass("pr-ok");useSpecialDone=false;}}});});}});})(jQuery);