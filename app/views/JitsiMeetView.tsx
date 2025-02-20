import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React from 'react';
import { BackHandler, Linking, NativeEventSubscription, SafeAreaView } from 'react-native';
import WebView from 'react-native-webview';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { IBaseScreen } from '../definitions';
import { userAgent } from '../lib/constants';
import { isIOS } from '../lib/methods/helpers';
import { getRoomIdFromJitsiCallUrl } from '../lib/methods/helpers/getRoomIdFromJitsiCall';
import { events, logEvent } from '../lib/methods/helpers/log';
import { endVideoConfTimer, initVideoConfTimer } from '../lib/methods/videoConfTimer';
import { ChatsStackParamList } from '../stacks/types';
import { withTheme } from '../theme';

type TJitsiMeetViewProps = IBaseScreen<ChatsStackParamList, 'JitsiMeetView'>;

class JitsiMeetView extends React.Component<TJitsiMeetViewProps> {
	private rid: string;
	private url: string;
	private videoConf: boolean;
	private backHandler!: NativeEventSubscription;

	constructor(props: TJitsiMeetViewProps) {
		super(props);
		this.rid = props.route.params?.rid;
		this.url = props.route.params?.url;
		this.videoConf = !!props.route.params?.videoConf;
	}

	componentDidMount() {
		this.handleJitsiApp();
		this.onConferenceJoined();
		activateKeepAwakeAsync();
	}

	componentWillUnmount() {
		logEvent(this.videoConf ? events.LIVECHAT_VIDEOCONF_TERMINATE : events.JM_CONFERENCE_TERMINATE);
		if (!this.videoConf) {
			endVideoConfTimer();
		}
		if (this.backHandler) {
			this.backHandler.remove();
		}
		deactivateKeepAwake();
	}

	handleJitsiApp = async () => {
		const { route, navigation } = this.props;
		const callUrl = route.params.url.replace(/^https?:\/\//, '');
		try {
			await Linking.openURL(`org.jitsi.meet://${callUrl}`);
			navigation.pop();
		} catch (error) {
			// As the jitsi app was not opened disable the backhandler on android
			this.backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
		}
	};

	// Jitsi Update Timeout needs to be called every 10 seconds to make sure
	// call is not ended and is available to web users.
	onConferenceJoined = () => {
		logEvent(this.videoConf ? events.LIVECHAT_VIDEOCONF_JOIN : events.JM_CONFERENCE_JOIN);
		if (this.rid && !this.videoConf) {
			initVideoConfTimer(this.rid);
		}
	};

	onNavigationStateChange = (webViewState: WebViewNavigation) => {
		const { navigation, route } = this.props;

		const roomId = getRoomIdFromJitsiCallUrl(route.params.url);

		if ((roomId && !webViewState.url.includes(roomId)) || webViewState.url.includes('close')) {
			if (isIOS) {
				if (webViewState.navigationType) {
					navigation.pop();
				}
			} else {
				navigation.pop();
			}
		}
	};

	render() {
		const uri = `${this.url}${this.url.includes('#config') ? '&' : '#'}config.disableDeepLinking=true`;
		return (
			<SafeAreaView style={{ flex: 1 }}>
				<WebView
					source={{ uri: uri.replace(/"/g, "'") }}
					onNavigationStateChange={this.onNavigationStateChange}
					// Jitsi default background color
					style={{ flex: 1, backgroundColor: 'rgb(62,62,62)' }}
					userAgent={userAgent}
					javaScriptEnabled
					domStorageEnabled
					mediaPlaybackRequiresUserAction={false}
					mediaCapturePermissionGrantType={'grant'}
				/>
			</SafeAreaView>
		);
	}
}

export default withTheme(JitsiMeetView);
