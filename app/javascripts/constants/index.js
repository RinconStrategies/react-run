/**
 * The initialScript is the script that shows in the initial window
 */
export const initialScript = `/**
 * Welcome to the React.run beta! The in-browser React testing environment.
 * This "Main" component is required for React.run to work,
 * and it is your main Application entry point. You can feel free
 * to modify it and add other components. Enjoy!
 *
 * URL: Your React.run URL contains two segments
 * and matches the following pattern, www.react.run/:run.id/:revision.id
 * and are unique to each component and revision that you create.
 * The revision.id is updated every time you save.
 *
 * State: React.run preserves your app state changes
 * as you code As an added bonus, React.run will save your
 * components state to the server and rehydrate it as well!!
 *
 * Toolbar: The toolbar above your code allows you to save your work and
 * view revisions of previous components you have created. Tip: You can
 * save your work by typing "cmd+s" or "window + s" on windows
 *
 * Globals Usage: Currently React.run exposes only two global
 * variables for your use, "React" and "ReactDOM".
 * There are plans to add more soon!
 *
 * This is a beta so expect more features soon!
 * Built with love by http://rinconstrategies.io
 */
class Main extends React.Component {
    constructor(){
        super();
    }
    render() {
        return (<div>Welcome to React.run!</div>)
    }
}`;

/**
 * The babelFrameScript is our script that gets injected into the running frame
 * @param code
 */
export const babelFrameScript = ( code ) =>`try{` + code + `

                var mountNode = document.getElementById('client_results');

                //check for previous state
                var state = getPreviousState();
                var MainComponent = ComponentTree.render({
                  component: Main,
                  snapshot: state,
                  container: mountNode
                });

                //add the ability to get state
                window.getState = function(){
                     return  ComponentTree.serialize(MainComponent);
                };
                //clear any frame errors on load
                if (window.__clearMessages) {
                     __clearMessages();
                }

            }catch(e){console.error(e)}`;