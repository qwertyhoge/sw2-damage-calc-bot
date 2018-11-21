/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Copyright SNE™ for damage table,"威力表"

  Run this bot from the command line:

    token=xxxxxx node slack_sw2_damage_bot.js
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var os = require('os');

var controller = Botkit.slackbot({
    debug: false
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

	bot.startConversation(message, function(err, convo) {

		convo.ask('Are you sure you want me to shutdown?', [
			{
				pattern: bot.utterances.yes,
				callback: function(response, convo) {
					convo.say('Bye!');
					convo.next();
					setTimeout(function() {
						process.exit();
					}, 3000);
				}
			},
		{
			pattern: bot.utterances.no,
			default: true,
			callback: function(response, convo) {
				convo.say('*Phew!*');
				convo.next();
			}
		}
		]);
	});
});


controller.hears([''], 'direct_message,direct_mention,mention', function(bot, message){

	var matches=message.text.match(/(\d+)\s+(\d+)\s*(.*)/);
	var power;
	var critNum;
	var correctionsStr;
	var tmpCorrectionArray;
	var corrections=null;
	var diceCorrection=0;0
	var total=0;
	var dices=new Array(2);
	var damages=new Array(); 
	var times=1;
	var damage;


	// if message didn't match, show error and exit
	if(matches==null){
		bot.reply(message,'Incorrect message is received.You should say below:\n@damage_bot (0<=damage power<=100) (8<=critical number<=13) (correction,correction,..correction) (dice correction)');
	}else{
		//take parameters from match()
		power=matches[1];
		critNum=matches[2];
		correctionsStr=matches[3];

		tmpCorrectionArray=calcCorrections(correctionsStr);
	
		if(tmpCorrectionArray!=null){
			corrections=tmpCorrectionArray[0];
			if(tmpCorrectionArray[1]==''){
				diceCorrection=0;
			}else{
				diceCorrection=Number(tmpCorrectionArray[1]);
			}
		}


//matches[3]  null  null Nnull Nnull
//corrections null Nnull null  Nnull
//term         1     x    0      1

//tmpCorrectionArray    null  null Nnull Nnull
//tmpCorrectionArray[1] null Nnull null  Nnull
//term                   1     x     0      1	

		if(parseInt(power)>=0 && parseInt(power) <=100 && parseInt(critNum)>=8 && parseInt(critNum)<=13 && !(myXOR(matches[3],corrections)) && (tmpCorrectionArray==null || (tmpCorrectionArray!=null && tmpCorrectionArray[1]!=null))){ //terms of correct message

			//report about corrections
			if(corrections!=null)
				bot.reply(message,'corrections sum:' + arrayToFormula(corrections) + '= *' + sum(corrections) + '*');

			//this loop runs while rollings work out critical
			do{
				// disable dice correction since twice roll
				if(times==2){
					diceCorrection=0;
				}

				//roll dice and add to array
				dices=roll_dice();
				damages.push(calcDamage(power,sum(dices),diceCorrection));

				//report about rolling with damage
				if(diceCorrection>0){
					bot.reply(message, times + '-roll:dices are *' + dices[0] + ',' + dices[1] + ' +' + diceCorrection + '* =>damage: *' + damages[times-1] + '*');
				}else{
					bot.reply(message, times + '-roll:dices are *' + dices[0] + ',' + dices[1] + '* =>damage: *' + damages[times-1] + '*');
				}

				if(dices.toString()=='1,1'){
					//provoke player (*important*)
					bot.reply(message,'*FUMBLE!!  looooooooooool  XDXDXDXD*');
				}else{
					if(sum(dices)+diceCorrection>=critNum && critNum<13){
						bot.reply(message,'*CRITICAL!!*');
					}

					total+=damages[times-1];
				}

				times++;
			}while(sum(dices)+diceCorrection>=critNum && critNum<13);

			if(damages.length==1 && dices.toString()=='1,1'){
				bot.reply(message,'THE DAMAGE IS *ZERO!!* sorry! :stuck_out_tongue_closed_eyes:');
			}else{
				if(corrections!=null){
					//use variable "damage" as int
					damage=Number(total)+Number(sum(corrections));

					//add sum of corrections to damage array(to calclate)			
					damages.push(sum(corrections));

					//report finally damage and its element
					bot.reply(message,'*the damage:' + damage + '* (' + arrayToFormula(damages) + ')');

				}else{
					bot.reply(message,'*the damage:' + total + '* (' + arrayToFormula(damages) + ')');
				}
			}

			
		//if value was not correct, show error and exit
		}else{
			bot.reply(message,'Incorrect message is received.You should say below:\n@damage_bot (0<=damage power<=100) (8<=critical number<=13) (correction,correction,..correction) (dice correction)');
		}
	}
});


//call function in rpg-dice and return the array
function roll_dice(){
	var dice=require('rpg-dice');
	var result=dice.roll(2,6);


	return result.rolls;
}


//calclate damage by power and 2d6 number from damage table
function calcDamage(power,rawDiceSum,diceCorrection){
	var tablemod=require('./slack_trpg/sw2_damage_table.js');

	//fumble damage is treated as 0 damage
	if(rawDiceSum<=2){
		return 0;
	}

	if(rawDiceSum+diceCorrection>12){
		return tablemod.table[power][12-3];
	}

	return tablemod.table[power][rawDiceSum+diceCorrection-3];
}


function calcCorrections(correctionsStr){
	var splitedStrs;
	var array=new Array;
	var matches=new Array;

	if(correctionsStr==''){
		return null;
	}

	splitedStrs=correctionsStr.split(',');
	for(var i=0;i<splitedStrs.length-1;i++){
		splitedStrs[i]=splitedStrs[i].replace(/\s+/g,'');
        	//find strange letter and return null
		if(isFinite(splitedStrs[i])==false){
			return null;
		}else if(splitedStrs[i]!=''){
			array.push(Number(splitedStrs[i]));
		}
	}


	matches=splitedStrs[i].match(/(-?\d+)\s*(.*)/);
	if(matches==null){
		return null;
	}else{
		array.push(matches[1]);

		if(isFinite(matches[2])==false){
			matches[2]=null;
		}

		return [array,matches[2]];
	}

}


/* THIS IS UNUSED FUNCTION */
//make integer array(probably not only int) from string whose format is 'int,int,int,...' and return the array
function numsWithCommaToArray(str){
	var array=new Array;
	var splitedStrs;

	//split argument string by , after delete all spaces
	str=str.replace(/\s+/g,'');
	splitedStrs=str.split(',');

	//if argument has no letter, return null
	if(str==''){
		return null;
	}

	for(var i=0;i<splitedStrs.length;i++){
		//find strange letter and return null
		if(isFinite(splitedStrs[i])==false){
			return null;
		}else if(splitedStrs[i]!=''){
			array.push(splitedStrs[i]);
		}
	}

	return array;
}


//make string of formula(addition,subtraction) from integer array(probably not only int) and return the formula
function arrayToFormula(array){
	var formula=new String();

	for(var i=0;i<array.length;i++){
		formula+=array[i];
		if(i<array.length-1 && array[i+1]>=0)
			formula+='+';

	}


	return formula;
}


//calculate summation of integer array and return it
function sum(array){
	var total=0;
	for(var i=0;i<array.length;i++){
		if(isFinite(array[i])==true){
			total+=Number(array[i]);
		}
	}
	return total;
}



function myXOR(array1,array2){
	var term1=new Boolean;
	var term2=new Boolean;

	if(array1==null || array1==''){
		term1=false;
	}else term1=true;
	if(array2==null){
		term2=false;
	}else term2=true;

	return (term1 && !term2) || (!term1 && term2);
}

