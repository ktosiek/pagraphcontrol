/* global document */

const {
	map,
	prop,
	groupBy,
	flatten,
} = require('ramda');

const React = require('react');

const r = require('r-dom');

const plusMinus = require('../../utils/plus-minus');

const memoize = require('../../utils/memoize');

const {
	GraphView: GraphViewBase,
} = require('./base');

const originalEdgeToSatelliteNode = edge => ({
	id: `${edge.target}__satellite__${edge.id}`,
	edge: edge.id,
	source: edge.source,
	target: edge.target,
	type: 'satellite',
});

const originalEdgeAndSatelliteNodeToSatelliteEdge = (edge, satelliteNode) => {
	const satelliteEdge = {
		id: edge.id,
		source: edge.source,
		target: satelliteNode.id,
		originalTarget: edge.target,
		index: edge.index,
		type: edge.type,
	};

	satelliteEdgeToOriginalEdge.set(satelliteEdge, edge);
	return satelliteEdge;
};

const originalEdgeToSatellites = memoize(edge => {
	const satelliteNode = originalEdgeToSatelliteNode(edge);
	const satelliteEdge = originalEdgeAndSatelliteNodeToSatelliteEdge(edge, satelliteNode);
	return { satelliteEdge, satelliteNode };
});

const Satellite = () => r(React.Fragment);

const satelliteSpread = 36;

const satelliteEdgeToOriginalEdge = new WeakMap();

class GraphView extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			originalEdgesByTargetNodeKey: {},
			satelliteNodesByTargetNodeKey: {},
			satelliteEdges: [],
			selected: null,
		};

		this.graph = React.createRef();

		Object.assign(this, {
			onSwapEdge: this.onSwapEdge.bind(this),
			onNodeMove: this.onNodeMove.bind(this),

			onSelectEdge: this.onSelectEdge.bind(this),

			renderNode: this.renderNode.bind(this),
			renderNodeText: this.renderNodeText.bind(this),

			renderEdge: this.renderEdge.bind(this),
			renderEdgeText: this.renderEdgeText.bind(this),

			afterRenderEdge: this.afterRenderEdge.bind(this),
		});
	}

	static getDerivedStateFromProps(props) {
		const originalEdgesByTargetNodeKey = groupBy(prop('target'), props.edges);

		let { selected } = props;

		const satelliteEdges = [];

		const satelliteNodesByTargetNodeKey = map(edges => map(edge => {
			const {
				satelliteNode,
				satelliteEdge,
			} = originalEdgeToSatellites(edge);

			if (edge === selected) {
				selected = satelliteEdge;
			}

			satelliteEdges.push(satelliteEdge);

			return satelliteNode;
		}, edges), originalEdgesByTargetNodeKey);

		return {
			originalEdgesByTargetNodeKey,
			satelliteNodesByTargetNodeKey,
			satelliteEdges,
			selected,
		};
	}

	static repositionSatellites(position, satelliteNodes) {
		satelliteNodes.forEach((satelliteNode, i) => {
			satelliteNode.x = position.x;
			satelliteNode.y = position.y +
				(satelliteSpread * plusMinus(i)) +
				((satelliteSpread / 2) * ((satelliteNodes.length + 1) % 2));
		});
	}

	onSwapEdge(sourceNode, targetNode, edge) {
		this.props.onSwapEdge(sourceNode, targetNode, edge);

		const { nodeKey } = this.props;

		const createdEdgeId = `edge-${sourceNode[nodeKey]}-${targetNode[nodeKey]}-container`;
		const createdEdge = document.getElementById(createdEdgeId);
		createdEdge.remove();
		this.graph.current.forceUpdate();
	}

	onNodeMove(position, nodeId, shiftKey) {
		const { nodeKey } = this.props;
		const satelliteNodes = this.state.satelliteNodesByTargetNodeKey[nodeId];
		if (satelliteNodes) {
			this.constructor.repositionSatellites(position, satelliteNodes);
			satelliteNodes.forEach(satelliteNode => {
				this.graph.current.handleNodeMove(satelliteNode, satelliteNode[nodeKey], shiftKey);
			});
		}
	}

	onSelectEdge(edge) {
		const originalEdge = satelliteEdgeToOriginalEdge.get(edge);
		this.props.onSelectEdge(originalEdge);
	}

	renderNode(nodeRef, dgo, key, selected, hovered) {
		if (dgo.type !== 'satellite') {
			return this.props.renderNode(nodeRef, dgo, key, selected, hovered);
		}

		return r(Satellite);
	}

	renderNodeText(dgo, ...rest) {
		if (dgo.type !== 'satellite') {
			return this.props.renderNodeText(dgo, ...rest);
		}

		return r(React.Fragment);
	}

	renderEdge(...args) {
		return this.props.renderEdge(...args);
	}

	renderEdgeText(...args) {
		return this.props.renderEdgeText(...args);
	}

	afterRenderEdge(id, element, edge, edgeContainer) {
		const originalEdge = satelliteEdgeToOriginalEdge.get(edge);
		this.props.afterRenderEdge(id, element, originalEdge || edge, edgeContainer);
	}

	render() {
		const { nodeKey } = this.props;
		const {
			satelliteNodesByTargetNodeKey,
			satelliteEdges: edges,
			selected,
		} = this.state;

		const nodes = flatten(map(node => {
			const satelliteNodes = satelliteNodesByTargetNodeKey[node[nodeKey]] || [];
			this.constructor.repositionSatellites(node, satelliteNodes);
			return satelliteNodes.concat(node);
		}, this.props.nodes));

		return r(GraphViewBase, {
			...this.props,

			selected,

			ref: this.graph,

			nodes,
			edges,

			onSwapEdge: this.onSwapEdge,
			onNodeMove: this.onNodeMove,

			onSelectEdge: this.onSelectEdge,

			renderNode: this.renderNode,
			renderNodeText: this.renderNodeText,

			renderEdge: this.renderEdge,
			renderEdgeText: this.renderEdgeText,

			afterRenderEdge: this.props.afterRenderEdge && this.afterRenderEdge,
		});
	}
}

module.exports = { GraphView };