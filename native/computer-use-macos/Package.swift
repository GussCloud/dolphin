// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "DolphinComputerUseMacOS",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "DolphinComputerUseMacOSCore",
            targets: ["DolphinComputerUseMacOSCore"]
        ),
        .executable(
            name: "dolphin-computer-use-macos",
            targets: ["DolphinComputerUseMacOS"]
        )
    ],
    targets: [
        .target(
            name: "DolphinComputerUseMacOSCore",
            path: "Sources/DolphinComputerUseMacOSCore"
        ),
        .executableTarget(
            name: "DolphinComputerUseMacOS",
            dependencies: ["DolphinComputerUseMacOSCore"],
            path: "Sources/DolphinComputerUseMacOS"
        ),
        .testTarget(
            name: "DolphinComputerUseMacOSTests",
            dependencies: ["DolphinComputerUseMacOSCore"],
            path: "Tests/DolphinComputerUseMacOSTests"
        )
    ]
)
